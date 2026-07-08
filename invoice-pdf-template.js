/**
 * LedgerFlow — Unified GST Invoice PDF Template
 * Matches gst-invoice-maker.html preview format (CGST Rule 46).
 */
(function () {
    'use strict';

    const STATE_NAMES = {
        '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
        '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
        '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
        '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
        '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
        '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '28': 'Andhra Pradesh',
        '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
        '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Ladakh', '38': 'Other Territory'
    };

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function stateName(code) {
        return STATE_NAMES[String(code)] || code || '—';
    }

    function fmt(n) {
        return (parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    function numberToWords(num) {
        const n = Math.round(parseFloat(num) || 0);
        if (n === 0) return 'Zero Rupees Only';
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
            'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        function lt1000(x) {
            if (x >= 100) return ones[Math.floor(x / 100)] + ' Hundred ' + lt1000(x % 100);
            if (x >= 20) return tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
            return ones[x];
        }
        const crore = Math.floor(n / 10000000);
        const lakh = Math.floor((n % 10000000) / 100000);
        const thousand = Math.floor((n % 100000) / 1000);
        const rem = n % 1000;
        let r = '';
        if (crore) r += lt1000(crore) + ' Crore ';
        if (lakh) r += lt1000(lakh) + ' Lakh ';
        if (thousand) r += lt1000(thousand) + ' Thousand ';
        if (rem) r += lt1000(rem);
        return r.trim() + ' Rupees Only';
    }

    const INVOICE_CSS = `
        .gst-pdf-root { font-family: Inter, Arial, sans-serif; font-size: 13.5px; line-height: 1.5; color: #0f172a; }
        .gst-pdf-preview { width: 794px; background: #fff; padding: 32px; box-sizing: border-box; }
        .gst-pdf-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 20px; }
        .gst-pdf-header-left { display: flex; gap: 16px; }
        .gst-pdf-logo { width: 64px; height: 64px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 12px; padding: 4px; }
        .gst-pdf-logo-ph { width: 64px; height: 64px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 24px; }
        .gst-pdf-co { font-size: 22px; font-weight: 700; color: #0f172a; }
        .gst-pdf-addr { font-size: 11px; color: #475569; margin-top: 2px; white-space: pre-line; }
        .gst-pdf-meta { font-size: 11px; margin-top: 6px; }
        .gst-pdf-title { font-size: 28px; font-weight: 800; color: #0f172a; text-align: right; letter-spacing: -1px; }
        .gst-pdf-invno { font-family: monospace; font-size: 18px; font-weight: 700; }
        .gst-pdf-section-title { font-size: 10px; font-weight: 800; color: #047857; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px; }
        .gst-pdf-box { border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; background: #f8fafc; }
        .gst-pdf-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 20px; }
        .gst-pdf-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 24px; }
        .gst-pdf-table th { background: #f8fafc; font-weight: 600; font-size: 10px; color: #334155; padding: 10px 6px; text-align: left; border-bottom: 2px solid #e2e8f0; }
        .gst-pdf-table td { padding: 9px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        .gst-pdf-table .r { text-align: right; font-variant-numeric: tabular-nums; }
        .gst-pdf-table .c { text-align: center; }
        .gst-pdf-badge { display: inline-block; padding: 1px 6px; background: #fef9c3; color: #a16207; font-size: 10px; font-weight: 700; border-radius: 4px; }
        .gst-pdf-totals { width: 380px; margin-top: 16px; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; font-size: 13px; }
        .gst-pdf-totals td { padding: 10px 20px; border-bottom: 1px solid #e2e8f0; }
        .gst-pdf-grand { background: #d1fae5; border-top: 2px solid #059669 !important; font-weight: 700; font-size: 15px; color: #065f46; }
        .gst-pdf-words { margin-top: 8px; font-size: 11px; background: #fefce8; border: 1px solid #fde047; color: #a16207; padding: 10px 12px; border-radius: 16px; }
        .gst-pdf-footer2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; font-size: 11px; }
        .gst-pdf-footer2 .gst-pdf-box { background: #fff; }
        .gst-pdf-sign { margin-top: 28px; padding-top: 20px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; }
        .gst-pdf-footnote { text-align: center; margin-top: 20px; font-size: 9px; color: #94a3b8; letter-spacing: 0.5px; }
        .gst-emerald { color: #047857; }
        .gst-blue { color: #1d4ed8; }
        .gst-purple { color: #7c3aed; }
        .gst-eway { margin-top:16px;padding:12px 14px;border:1px dashed #f59e0b;background:#fffbeb;border-radius:12px;font-size:11px; }
        .gst-eway-title { font-weight:800;color:#b45309;letter-spacing:0.5px;text-transform:uppercase;font-size:10px; }
        .gst-eway-no { font-family:monospace;font-size:16px;font-weight:700;color:#92400e;margin-top:4px; }
    `;

    function formatEwbNoPdf(no) {
        const s = String(no || '').replace(/\D/g, '');
        if (s.length !== 12) return esc(no);
        return `${s.slice(0, 4)} ${s.slice(4, 8)} ${s.slice(8, 12)}`;
    }

    function buildEwayPdfBlock(eway) {
        if (!eway?.ewbNo) return '';
        const valid = eway.validUpto ? new Date(eway.validUpto).toLocaleString('en-IN') : '—';
        const modes = { '1': 'Road', '2': 'Rail', '3': 'Air', '4': 'Ship' };
        const mode = modes[eway.transportMode] || 'Road';
        return `<div class="gst-eway">
            <div class="gst-eway-title">E-Way Bill Details</div>
            <div class="gst-eway-no">${formatEwbNoPdf(eway.ewbNo)}</div>
            <div style="color:#78350f;margin-top:6px;">Generated: ${esc(eway.ewbDate || '—')} • Valid upto: ${esc(valid)}</div>
            <div style="color:#78350f;margin-top:4px;">Transport: ${esc(mode)}${eway.vehicleNo ? ' • Vehicle: ' + esc(eway.vehicleNo) : ''}${eway.distanceKm ? ' • ' + esc(eway.distanceKm) + ' km' : ''}</div>
            ${eway.transporterName ? `<div style="color:#78350f;margin-top:4px;">Transporter: ${esc(eway.transporterName)}</div>` : ''}
        </div>`;
    }

    window.buildGSTInvoiceHTML = function (data) {
        const s = data.supplier || {};
        const r = data.recipient || {};
        const ship = data.shipTo || { sameAsBillTo: true };
        const inv = data.invoice || {};
        const bank = data.bank || {};
        const t = data.totals || {};
        const items = data.items || [];
        const isIntra = t.isIntraState !== false && (t.totalIGST || 0) === 0;
        const pos = stateName(inv.placeOfSupplyCode || r.stateCode || s.stateCode);

        let rows = '';
        if (!items.length) {
            rows = '<tr><td colspan="13" style="text-align:center;padding:32px;color:#94a3b8;font-style:italic;">No line items</td></tr>';
        } else {
            items.forEach((item, i) => {
                rows += `<tr>
                    <td class="c" style="font-weight:600;color:#64748b;">${i + 1}</td>
                    <td style="font-weight:500;">${esc(item.desc || item.description || '—')}</td>
                    <td style="font-family:monospace;font-size:11px;color:#475569;">${esc(item.hsn || '—')}</td>
                    <td class="c">${item.qty ?? 1}</td>
                    <td style="font-size:11px;">${esc(item.unit || 'Nos')}</td>
                    <td class="r" style="font-family:monospace;">${fmt(item.rate)}</td>
                    <td class="c">${item.discPercent ?? 0}%</td>
                    <td class="r" style="font-weight:500;">${fmt(item.taxable)}</td>
                    <td class="c"><span class="gst-pdf-badge">${item.gstPercent ?? 18}%</span></td>
                    <td class="r gst-emerald" style="font-family:monospace;">${item.cgst > 0 ? fmt(item.cgst) : '—'}</td>
                    <td class="r gst-emerald" style="font-family:monospace;">${item.sgst > 0 ? fmt(item.sgst) : '—'}</td>
                    <td class="r gst-blue" style="font-family:monospace;">${item.igst > 0 ? fmt(item.igst) : '—'}</td>
                    <td class="r" style="font-weight:700;">${fmt(item.total ?? (item.taxable + (item.cgst||0) + (item.sgst||0) + (item.igst||0)))}</td>
                </tr>`;
            });
        }

        let taxRows = '';
        if (isIntra) {
            taxRows += `<tr><td>CGST</td><td class="r gst-emerald" style="font-weight:600;">₹ ${fmt(t.totalCGST)}</td></tr>`;
            taxRows += `<tr><td>SGST</td><td class="r gst-emerald" style="font-weight:600;">₹ ${fmt(t.totalSGST)}</td></tr>`;
        } else {
            taxRows += `<tr><td>IGST</td><td class="r gst-blue" style="font-weight:600;">₹ ${fmt(t.totalIGST)}</td></tr>`;
        }
        if (t.roundOff) {
            taxRows += `<tr><td>Round Off</td><td class="r" style="font-weight:600;">${t.roundOff > 0 ? '+' : ''}₹ ${fmt(t.roundOff)}</td></tr>`;
        }
        if (t.tcsEnabled && t.tcsAmount) {
            taxRows += `<tr><td class="gst-purple">TCS @ ${t.tcsRate}% (${esc(t.tcsSection)})</td><td class="r gst-purple" style="font-weight:600;">₹ ${fmt(t.tcsAmount)}</td></tr>`;
        }

        return `<div class="gst-pdf-root"><style>${INVOICE_CSS}</style>
        <div class="gst-pdf-preview">
            <div class="gst-pdf-header">
                <div class="gst-pdf-header-left">
                    ${s.logo ? `<img src="${s.logo}" class="gst-pdf-logo" alt="Logo">` : `<div class="gst-pdf-logo-ph">&#127970;</div>`}
                    <div>
                        <div class="gst-pdf-co">${esc(s.name || 'Supplier')}</div>
                        <div class="gst-pdf-addr">${esc(s.address || '')}</div>
                        <div class="gst-pdf-meta">
                            <strong>GSTIN:</strong> <span style="font-family:monospace;">${esc(s.gstin || 'N/A')}</span>
                            ${s.pan ? ` &nbsp; <strong>PAN:</strong> <span style="font-family:monospace;">${esc(s.pan)}</span>` : ''}
                        </div>
                        <div class="gst-pdf-meta" style="color:#64748b;">${esc(s.phone || '')}${s.email ? ' • ' + esc(s.email) : ''}</div>
                    </div>
                </div>
                <div style="text-align:right;">
                    <div class="gst-pdf-title">TAX INVOICE</div>
                    <div style="font-size:11px;color:#64748b;margin-top:12px;">Invoice No.</div>
                    <div class="gst-pdf-invno">${esc(inv.number || 'INV-0000')}</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px;font-size:11px;text-align:left;">
                        <div><div style="color:#64748b;">Date</div><div style="font-weight:500;">${esc(inv.date || '')}</div></div>
                        <div><div style="color:#64748b;">Due Date</div><div style="font-weight:500;">${esc(inv.dueDate || '—')}</div></div>
                    </div>
                </div>
            </div>

            <div style="display:flex;justify-content:space-between;margin-top:16px;font-size:11px;">
                <div><span style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;">Place of Supply</span> <strong>${pos}</strong></div>
                <div style="text-align:right;">
                    <div style="color:#64748b;font-size:10px;">Supply Type</div>
                    <div style="font-weight:700;color:${isIntra ? '#059669' : '#2563eb'};">${isIntra ? 'INTRA-STATE (CGST + SGST)' : 'INTER-STATE (IGST)'}</div>
                </div>
            </div>

            <div class="gst-pdf-grid2">
                <div class="gst-pdf-box">
                    <div class="gst-pdf-section-title">Bill To</div>
                    <div style="font-weight:600;font-size:15px;">${esc(r.name || 'Customer')}</div>
                    <div class="gst-pdf-addr" style="margin-top:4px;">${esc(r.address || '')}</div>
                    <div style="margin-top:8px;font-size:11px;">
                        ${r.gstin ? `<span style="font-family:monospace;background:#fff;padding:2px 8px;border:1px solid #e2e8f0;border-radius:4px;">${esc(r.gstin)}</span>` : '<span style="color:#d97706;font-weight:500;">Unregistered</span>'}
                        <span style="color:#64748b;margin-left:8px;">${stateName(r.stateCode)}</span>
                    </div>
                </div>
                <div class="gst-pdf-box">
                    <div class="gst-pdf-section-title">Ship To</div>
                    ${ship.sameAsBillTo !== false ? '<div style="font-style:italic;color:#64748b;font-size:11px;">Same as Bill To address</div>' : `
                        <div style="font-weight:600;font-size:15px;">${esc(ship.name || r.name)}</div>
                        <div class="gst-pdf-addr" style="margin-top:4px;">${esc(ship.address || r.address || '')}</div>
                        <div style="margin-top:4px;font-size:11px;color:#64748b;">${stateName(ship.stateCode || r.stateCode)}</div>
                    `}
                </div>
            </div>

            <table class="gst-pdf-table">
                <thead><tr>
                    <th class="c" style="width:28px;">#</th>
                    <th>Description of Goods / Services</th>
                    <th style="width:72px;">HSN / SAC</th>
                    <th class="c" style="width:40px;">Qty</th>
                    <th style="width:48px;">Unit</th>
                    <th class="r" style="width:72px;">Rate (₹)</th>
                    <th class="c" style="width:48px;">Disc %</th>
                    <th class="r" style="width:88px;">Taxable Value (₹)</th>
                    <th class="c" style="width:48px;">GST %</th>
                    <th class="r" style="width:72px;">CGST (₹)</th>
                    <th class="r" style="width:72px;">SGST (₹)</th>
                    <th class="r" style="width:72px;">IGST (₹)</th>
                    <th class="r" style="width:80px;">Total (₹)</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>

            <div style="display:flex;justify-content:flex-end;margin-top:16px;">
                <div style="width:380px;">
                    <table class="gst-pdf-totals" style="width:100%;border-collapse:collapse;">
                        <tr><td>Total Taxable Value</td><td class="r" style="font-weight:600;">₹ ${fmt(t.totalTaxable)}</td></tr>
                        ${taxRows}
                        <tr class="gst-pdf-grand"><td>GRAND TOTAL${t.tcsEnabled ? ' (incl. TCS)' : ''}</td><td class="r">₹ ${fmt(t.finalGrandTotal ?? t.grandTotal)}</td></tr>
                    </table>
                    <div class="gst-pdf-words"><strong>Amount in words:</strong><br>${numberToWords(t.finalGrandTotal ?? t.grandTotal)}</div>
                </div>
            </div>

            ${buildEwayPdfBlock(data.ewayBill)}

            <div class="gst-pdf-footer2">
                <div class="gst-pdf-box">
                    <div class="gst-pdf-section-title">Bank Details</div>
                    ${bank.name ? `
                        <div><strong>Bank:</strong> ${esc(bank.name)}</div>
                        <div><strong>A/c No:</strong> <span style="font-family:monospace;">${esc(bank.account)}</span></div>
                        <div><strong>IFSC:</strong> <span style="font-family:monospace;">${esc(bank.ifsc)}</span></div>
                        <div><strong>Branch:</strong> ${esc(bank.branch)}</div>
                    ` : '<div style="font-style:italic;color:#94a3b8;">Bank details not provided</div>'}
                </div>
                <div class="gst-pdf-box">
                    <div class="gst-pdf-section-title">Terms &amp; Conditions</div>
                    <div style="white-space:pre-line;font-size:11px;color:#475569;line-height:1.4;">${esc(data.terms || 'Standard terms apply.')}</div>
                    ${data.notes ? `<div style="margin-top:12px;padding-top:12px;border-top:1px dashed #cbd5e1;"><strong class="gst-emerald">Note:</strong> ${esc(data.notes)}</div>` : ''}
                </div>
            </div>

            <div class="gst-pdf-sign">
                <div style="max-width:260px;">
                    <div style="font-weight:700;">Declaration</div>
                    <div style="color:#475569;line-height:1.4;margin-top:4px;">We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.</div>
                    <div style="margin-top:12px;font-size:10px;color:#64748b;">This is a computer generated invoice and does not require physical signature.</div>
                </div>
                <div style="text-align:right;">
                    <div style="color:#64748b;margin-bottom:4px;">For <strong>${esc(s.name)}</strong></div>
                    <div style="height:48px;"></div>
                    <div style="border-top:1px solid #94a3b8;padding-top:4px;">
                        <div style="font-weight:600;">Authorized Signatory</div>
                    </div>
                </div>
            </div>

            <div class="gst-pdf-footnote">GST Compliant Invoice • Generated on ${new Date().toLocaleDateString('en-IN')} • LedgerFlow GST Invoice</div>
        </div></div>`;
    };

    window.crmClientInvoiceToPDFData = function (client, inv) {
        const customer = (client.customers || []).find(c => c.name === inv.partyName);
        const isIntra = !(inv.igst > 0);
        let items = [];
        if (inv.itemDetails?.length) {
            items = inv.itemDetails.map(it => ({
                desc: it.desc || it.description,
                hsn: it.hsn || '9983',
                qty: it.qty ?? 1,
                unit: it.unit || 'Nos',
                rate: it.rate ?? 0,
                discPercent: it.discPercent ?? 0,
                taxable: it.taxable ?? 0,
                gstPercent: it.gstPercent ?? 18,
                cgst: it.cgst ?? 0,
                sgst: it.sgst ?? 0,
                igst: it.igst ?? 0,
                total: it.total ?? (it.taxable + (it.cgst||0) + (it.sgst||0) + (it.igst||0))
            }));
        } else {
            const gstPct = inv.taxable > 0 ? Math.round(((inv.cgst + inv.sgst + inv.igst) / inv.taxable) * 100) : 18;
            items = [{
                desc: 'Goods / Services as per invoice',
                hsn: '9983', qty: inv.items || 1, unit: 'Nos',
                rate: inv.taxable / (inv.items || 1),
                discPercent: 0, taxable: inv.taxable, gstPercent: gstPct,
                cgst: inv.cgst, sgst: inv.sgst, igst: inv.igst, total: inv.grandTotal
            }];
        }
        return {
            supplier: {
                name: client.name, address: client.address, gstin: client.gstin, pan: client.pan,
                phone: client.phone, email: client.email, logo: client.logo, stateCode: client.stateCode
            },
            recipient: {
                name: inv.partyName, address: customer?.address || '', gstin: customer?.gstin || '',
                stateCode: customer?.stateCode || client.stateCode
            },
            shipTo: { sameAsBillTo: true },
            invoice: {
                number: inv.number, date: inv.date, dueDate: inv.dueDate || '',
                placeOfSupplyCode: customer?.stateCode || client.stateCode
            },
            bank: client.bank || {},
            terms: client.terms, notes: client.notes || '',
            ewayBill: inv.ewayBill || null,
            items,
            totals: {
                totalTaxable: inv.taxable, totalCGST: inv.cgst, totalSGST: inv.sgst, totalIGST: inv.igst,
                roundOff: inv.roundOff || 0,
                tcsEnabled: (inv.tcs || 0) > 0, tcsRate: inv.tcsRate || 0, tcsSection: inv.tcsSection || '',
                tcsAmount: inv.tcs || 0, finalGrandTotal: inv.grandTotal, isIntraState: isIntra
            }
        };
    };

    window.adminInvoiceToPDFData = function (client, inv) {
        if (typeof normalizeAdminInvoice === 'function') normalizeAdminInvoice(inv, client);
        if (typeof ensureFirmSettings === 'function') ensureFirmSettings();
        const firm = inv.billFrom || appData.firmSettings;
        const buyer = inv.billTo || {
            name: client.name, gstin: client.gstin, address: client.address,
            stateCode: client.stateCode, phone: client.phone, email: client.email
        };
        const isIntra = !(inv.igst > 0);
        const items = inv.items?.length ? inv.items.map(it => ({
            desc: it.description || it.desc || inv.serviceName,
            hsn: it.hsn || inv.hsnSac || '9983',
            qty: it.qty ?? 1, unit: it.unit || 'Service', rate: it.rate ?? inv.taxable,
            discPercent: 0, taxable: it.taxable ?? inv.taxable, gstPercent: it.gstPercent ?? inv.gstPercent ?? 18,
            cgst: it.cgst ?? inv.cgst, sgst: it.sgst ?? inv.sgst, igst: it.igst ?? inv.igst,
            total: (it.taxable ?? inv.taxable) + (it.cgst ?? inv.cgst) + (it.sgst ?? inv.sgst) + (it.igst ?? inv.igst)
        })) : [{
            desc: inv.serviceName, hsn: inv.hsnSac || '9983', qty: 1, unit: 'Service',
            rate: inv.taxable, discPercent: 0, taxable: inv.taxable, gstPercent: inv.gstPercent || 18,
            cgst: inv.cgst, sgst: inv.sgst, igst: inv.igst,
            total: inv.grandTotal || (inv.taxable + inv.cgst + inv.sgst + inv.igst)
        }];
        return {
            supplier: {
                name: firm.name, address: firm.address, gstin: firm.gstin, pan: firm.pan,
                phone: firm.phone, email: firm.email, logo: firm.logo, stateCode: firm.stateCode
            },
            recipient: {
                name: buyer.name, address: buyer.address || '', gstin: buyer.gstin || '',
                stateCode: buyer.stateCode || client.stateCode
            },
            shipTo: { sameAsBillTo: true },
            invoice: {
                number: inv.number, date: inv.date, dueDate: inv.dueDate || '',
                placeOfSupplyCode: inv.placeOfSupply || buyer.stateCode
            },
            bank: firm.bank || {},
            terms: inv.terms || firm.terms, notes: inv.description || '',
            items,
            totals: {
                totalTaxable: inv.taxable, totalCGST: inv.cgst, totalSGST: inv.sgst, totalIGST: inv.igst,
                roundOff: 0, tcsEnabled: false, finalGrandTotal: inv.grandTotal, isIntraState: isIntra
            }
        };
    };

    window.downloadGSTInvoicePDF = async function (pdfData, fileName) {
        if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
            if (typeof showToast === 'function') showToast('PDF libraries not loaded', 'error');
            return;
        }
        let renderEl = document.getElementById('gst-invoice-pdf-render');
        if (!renderEl) {
            renderEl = document.createElement('div');
            renderEl.id = 'gst-invoice-pdf-render';
            renderEl.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
            document.body.appendChild(renderEl);
        }
        renderEl.innerHTML = buildGSTInvoiceHTML(pdfData);
        const target = renderEl.querySelector('.gst-pdf-preview');
        if (!target) return;

        try {
            if (typeof showToast === 'function') showToast('Generating PDF...', 'info');
            const canvas = await html2canvas(target, {
                scale: 2.2, useCORS: true, backgroundColor: '#ffffff', logging: false
            });
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = 8;
            const availableWidth = pdfWidth - margin * 2;
            const availableHeight = pdfHeight - margin * 2;
            const ratio = Math.min(
                availableWidth / (canvas.width * 0.264583),
                availableHeight / (canvas.height * 0.264583)
            );
            const imgWidth = canvas.width * 0.264583 * ratio;
            const imgHeight = canvas.height * 0.264583 * ratio;
            const x = (pdfWidth - imgWidth) / 2;
            pdf.addImage(canvas.toDataURL('image/png', 0.95), 'PNG', x, margin, imgWidth, imgHeight);
            pdf.save(fileName || `GST_Invoice_${pdfData.invoice?.number || 'INV'}_${new Date().toISOString().slice(0, 10)}.pdf`);
            if (typeof showToast === 'function') showToast('GST Invoice PDF downloaded');
        } catch (e) {
            console.error(e);
            if (typeof showToast === 'function') showToast('PDF generation failed', 'error');
        } finally {
            renderEl.innerHTML = '';
        }
    };

})();