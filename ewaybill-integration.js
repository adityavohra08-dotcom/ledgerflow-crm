/**
 * LedgerFlow — E-Way Bill integration for GST Invoice Maker
 * Demo mode generates compliant payloads; live NIC API when backend credentials are set.
 */
(function () {
    'use strict';

    const EWAY_THRESHOLD_INR = 50000;
    const TRANSPORT_MODES = [
        { code: '1', label: 'Road' },
        { code: '2', label: 'Rail' },
        { code: '3', label: 'Air' },
        { code: '4', label: 'Ship' }
    ];
    const SUB_SUPPLY_TYPES = [
        { code: '1', label: 'Supply' },
        { code: '2', label: 'Import' },
        { code: '3', label: 'Export' },
        { code: '4', label: 'Job Work' },
        { code: '5', label: 'For Own Use' },
        { code: '8', label: 'Others' }
    ];

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function fmtDateNic(iso) {
        if (!iso) return '';
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y}`;
    }

    function fmtDateTimeNic(ts) {
        const d = ts ? new Date(ts) : new Date();
        const pad = n => String(n).padStart(2, '0');
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function extractPincode(address) {
        if (!address) return '';
        const m = String(address).match(/\b(\d{6})\b/);
        return m ? m[1] : '';
    }

    function parsePlace(address) {
        if (!address) return '';
        const lines = String(address).split('\n').map(s => s.trim()).filter(Boolean);
        return lines.length ? lines[lines.length - 1].replace(/\b\d{6}\b/g, '').trim() : '';
    }

    function defaultEwayBill() {
        return {
            enabled: false,
            supplyType: 'O',
            subSupplyType: '1',
            docType: 'INV',
            transportMode: '1',
            transporterId: '',
            transporterName: '',
            vehicleNo: '',
            transDocNo: '',
            distanceKm: 0,
            fromPincode: '',
            toPincode: '',
            vehicleType: 'R',
            ewbNo: '',
            ewbDate: '',
            validUpto: '',
            status: 'draft',
            mode: 'demo',
            generatedAt: null,
            nicPayload: null
        };
    }

    function isEwayBillRequired(grandTotal, options = {}) {
        if (options.force) return true;
        return (parseFloat(grandTotal) || 0) >= EWAY_THRESHOLD_INR;
    }

    function validateEwayBillInput(invoiceData, totals, eway) {
        const errors = [];
        const e = eway || invoiceData.ewayBill || {};
        if (!invoiceData.supplier?.gstin || invoiceData.supplier.gstin.length < 15) {
            errors.push('Valid supplier GSTIN is required');
        }
        if (!invoiceData.invoice?.number) errors.push('Invoice number is required');
        if (!invoiceData.invoice?.date) errors.push('Invoice date is required');
        if (!invoiceData.recipient?.name) errors.push('Recipient name is required');
        if (!totals?.items?.length) errors.push('Add at least one item');
        if (!e.fromPincode || String(e.fromPincode).length !== 6) {
            errors.push('From PIN code (6 digits) is required');
        }
        if (!e.toPincode || String(e.toPincode).length !== 6) {
            errors.push('To PIN code (6 digits) is required');
        }
        if (!e.transportMode) errors.push('Transport mode is required');
        if (e.transportMode === '1' && !e.vehicleNo?.trim()) {
            errors.push('Vehicle number is required for road transport');
        }
        if (!(parseInt(e.distanceKm, 10) > 0)) errors.push('Transport distance (km) is required');
        return errors;
    }

    function buildNicPayload(invoiceData, totals, eway) {
        const e = { ...defaultEwayBill(), ...eway };
        const fromPin = String(e.fromPincode || extractPincode(invoiceData.supplier.address));
        const toPin = String(e.toPincode || extractPincode(
            invoiceData.shipTo?.sameAsBillTo === false
                ? invoiceData.shipTo.address
                : invoiceData.recipient.address
        ));
        const toAddr = invoiceData.shipTo?.sameAsBillTo === false
            ? invoiceData.shipTo.address
            : invoiceData.recipient.address;
        const toState = invoiceData.shipTo?.sameAsBillTo === false
            ? invoiceData.shipTo.stateCode
            : invoiceData.recipient.stateCode;

        return {
            supplyType: e.supplyType || 'O',
            subSupplyType: e.subSupplyType || '1',
            subSupplyDesc: '',
            docType: e.docType || 'INV',
            docNo: invoiceData.invoice.number,
            docDate: fmtDateNic(invoiceData.invoice.date),
            fromGstin: invoiceData.supplier.gstin,
            fromTrdName: invoiceData.supplier.name,
            fromAddr1: (invoiceData.supplier.address || '').split('\n')[0] || invoiceData.supplier.address,
            fromPlace: parsePlace(invoiceData.supplier.address) || getStateLabel(invoiceData.supplier.stateCode),
            fromPincode: parseInt(fromPin, 10) || 0,
            fromStateCode: parseInt(invoiceData.supplier.stateCode, 10) || 0,
            actFromStateCode: parseInt(invoiceData.supplier.stateCode, 10) || 0,
            toGstin: invoiceData.recipient.gstin || 'URP',
            toTrdName: invoiceData.recipient.name,
            toAddr1: (toAddr || '').split('\n')[0] || toAddr,
            toPlace: parsePlace(toAddr) || getStateLabel(toState),
            toPincode: parseInt(toPin, 10) || 0,
            toStateCode: parseInt(toState, 10) || 0,
            actToStateCode: parseInt(toState, 10) || 0,
            transactionType: 1,
            totalValue: Math.round((totals.totalTaxable || 0) * 100) / 100,
            cgstValue: Math.round((totals.totalCGST || 0) * 100) / 100,
            sgstValue: Math.round((totals.totalSGST || 0) * 100) / 100,
            igstValue: Math.round((totals.totalIGST || 0) * 100) / 100,
            cessValue: 0,
            cessNonAdvolValue: 0,
            otherValue: totals.roundOff || 0,
            totInvValue: Math.round((totals.finalGrandTotal || 0) * 100) / 100,
            transMode: e.transportMode,
            transDistance: parseInt(e.distanceKm, 10) || 0,
            transporterName: e.transporterName || '',
            transporterId: e.transporterId || '',
            transDocNo: e.transDocNo || '',
            transDocDate: fmtDateNic(invoiceData.invoice.date),
            vehicleNo: (e.vehicleNo || '').toUpperCase().replace(/\s+/g, ''),
            vehicleType: e.vehicleType || 'R',
            itemList: (totals.items || []).map((it, idx) => ({
                itemNo: idx + 1,
                productName: it.desc || 'Goods',
                productDesc: it.desc || 'Goods',
                hsnCode: parseInt(String(it.hsn || '0').replace(/\D/g, ''), 10) || 0,
                quantity: parseFloat(it.qty) || 1,
                qtyUnit: it.unit || 'NOS',
                taxableAmount: Math.round((it.taxable || 0) * 100) / 100,
                cgstRate: totals.isIntraState ? (it.gstPercent || 0) / 2 : 0,
                sgstRate: totals.isIntraState ? (it.gstPercent || 0) / 2 : 0,
                igstRate: totals.isIntraState ? 0 : (it.gstPercent || 0),
                cessRate: 0
            }))
        };
    }

    const STATE_LABELS = {
        '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
        '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
        '10': 'Bihar', '19': 'West Bengal', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
        '24': 'Gujarat', '27': 'Maharashtra', '29': 'Karnataka', '32': 'Kerala', '33': 'Tamil Nadu', '36': 'Telangana'
    };

    function getStateLabel(code) {
        return STATE_LABELS[String(code)] || `State ${code}`;
    }

    function computeValidUpto(distanceKm) {
        const km = parseInt(distanceKm, 10) || 0;
        let days = 1;
        if (km > 100 && km <= 300) days = 3;
        else if (km > 300 && km <= 500) days = 5;
        else if (km > 500 && km <= 1000) days = 10;
        else if (km > 1000) days = 15;
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toISOString();
    }

    function generateDemoEwbNo() {
        const ts = Date.now().toString().slice(-8);
        const rand = String(Math.floor(1000 + Math.random() * 9000));
        return `${ts}${rand}`.slice(0, 12);
    }

    function formatEwbNo(no) {
        const s = String(no || '').replace(/\D/g, '');
        if (s.length !== 12) return no || '—';
        return `${s.slice(0, 4)} ${s.slice(4, 8)} ${s.slice(8, 12)}`;
    }

    function buildEwayBillHtml(eway, options = {}) {
        const e = eway || {};
        if (!e.ewbNo) return '';
        const compact = options.compact;
        const valid = e.validUpto ? new Date(e.validUpto).toLocaleString('en-IN') : '—';
        const modeLabel = TRANSPORT_MODES.find(m => m.code === e.transportMode)?.label || 'Road';
        if (compact) {
            return `<div style="margin-top:12px;padding:10px 12px;border:1px dashed #f59e0b;background:#fffbeb;border-radius:12px;font-size:11px;">
                <div style="font-weight:800;color:#b45309;letter-spacing:0.5px;text-transform:uppercase;font-size:10px;">E-Way Bill</div>
                <div style="font-family:monospace;font-size:15px;font-weight:700;color:#92400e;margin-top:4px;">${esc(formatEwbNo(e.ewbNo))}</div>
                <div style="color:#78350f;margin-top:4px;">Valid upto: ${esc(valid)} • ${esc(modeLabel)}${e.vehicleNo ? ' • ' + esc(e.vehicleNo) : ''}</div>
            </div>`;
        }
        return `<div class="border border-amber-300 rounded-2xl p-4 bg-amber-50 text-xs mt-4">
            <div class="font-extrabold text-amber-800 tracking-wider text-xs mb-2">E-WAY BILL DETAILS</div>
            <div class="grid grid-cols-2 gap-3">
                <div><span class="font-semibold text-amber-900">E-Way Bill No:</span><br><span class="font-mono text-lg font-bold text-amber-950">${esc(formatEwbNo(e.ewbNo))}</span></div>
                <div><span class="font-semibold text-amber-900">Generated:</span><br>${esc(e.ewbDate || '—')}</div>
                <div><span class="font-semibold text-amber-900">Valid Upto:</span><br>${esc(valid)}</div>
                <div><span class="font-semibold text-amber-900">Transport:</span><br>${esc(modeLabel)}${e.vehicleNo ? ' • ' + esc(e.vehicleNo) : ''}</div>
                ${e.transporterName ? `<div class="col-span-2"><span class="font-semibold text-amber-900">Transporter:</span> ${esc(e.transporterName)}${e.transporterId ? ' (' + esc(e.transporterId) + ')' : ''}</div>` : ''}
                ${e.distanceKm ? `<div><span class="font-semibold text-amber-900">Distance:</span> ${esc(e.distanceKm)} km</div>` : ''}
            </div>
            ${e.mode === 'demo' ? '<div class="mt-2 text-[10px] text-amber-700 italic">Demo e-way bill — configure NIC credentials on server for live generation.</div>' : ''}
        </div>`;
    }

    async function generateEwayBill(invoiceData, totals, eway, options = {}) {
        const errors = validateEwayBillInput(invoiceData, totals, eway);
        if (errors.length) return { ok: false, errors };

        const payload = buildNicPayload(invoiceData, totals, eway);
        const apiBase = options.apiBase || (typeof LedgerFlowBackend !== 'undefined' && LedgerFlowBackend.apiBase) || '';
        const token = options.token || (typeof LedgerFlowBackend !== 'undefined' && LedgerFlowBackend.token) || '';

        if (apiBase && token) {
            try {
                const res = await fetch(`${apiBase}/api/ewaybill/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ payload, invoiceNo: invoiceData.invoice?.number })
                });
                const data = await res.json();
                if (!res.ok) return { ok: false, errors: [data.error || 'E-way bill API failed'] };
                return { ok: true, ewayBill: data.ewayBill, payload };
            } catch (err) {
                return { ok: false, errors: [err.message || 'Network error'] };
            }
        }

        const ewbNo = generateDemoEwbNo();
        const now = new Date();
        const validUpto = computeValidUpto(eway.distanceKm);
        const result = {
            ...defaultEwayBill(),
            ...eway,
            enabled: true,
            ewbNo,
            ewbDate: fmtDateTimeNic(now),
            validUpto,
            status: 'generated',
            mode: 'demo',
            generatedAt: now.toISOString(),
            nicPayload: payload
        };
        return { ok: true, ewayBill: result, payload };
    }

    function invoiceToEwaySource(client, inv) {
        const customer = (client.customers || []).find(c => c.name === inv.partyName);
        const isIntra = !(inv.igst > 0);
        const items = inv.itemDetails?.length ? inv.itemDetails : [{
            desc: 'Goods / Services',
            hsn: '9983',
            qty: 1,
            unit: 'Nos',
            rate: inv.taxable,
            taxable: inv.taxable,
            gstPercent: inv.taxable > 0 ? Math.round(((inv.cgst + inv.sgst + inv.igst) / inv.taxable) * 100) : 18,
            cgst: inv.cgst,
            sgst: inv.sgst,
            igst: inv.igst
        }];
        return {
            invoiceData: {
                supplier: {
                    name: client.name,
                    address: client.address,
                    gstin: client.gstin,
                    stateCode: client.stateCode || '07'
                },
                invoice: { number: inv.number, date: inv.date },
                recipient: {
                    name: inv.partyName,
                    address: customer?.address || '',
                    gstin: customer?.gstin || '',
                    stateCode: customer?.stateCode || inv.placeOfSupplyCode || '07'
                },
                shipTo: { sameAsBillTo: true },
                ewayBill: inv.ewayBill || defaultEwayBill()
            },
            totals: {
                items,
                totalTaxable: inv.taxable,
                totalCGST: inv.cgst,
                totalSGST: inv.sgst,
                totalIGST: inv.igst,
                finalGrandTotal: inv.grandTotal,
                isIntraState: isIntra,
                roundOff: 0
            }
        };
    }

    window.LedgerFlowEwayBill = {
        EWAY_THRESHOLD_INR,
        TRANSPORT_MODES,
        SUB_SUPPLY_TYPES,
        defaultEwayBill,
        isEwayBillRequired,
        validateEwayBillInput,
        buildNicPayload,
        buildEwayBillHtml,
        generateEwayBill,
        invoiceToEwaySource,
        formatEwbNo,
        extractPincode,
        computeValidUpto
    };
})();