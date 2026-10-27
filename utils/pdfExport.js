// Advanced PDF Export System v3.0
// Professional PDF generation for warehouse inventory reports

class PDFExporter {
    constructor() {
        this.pdfMake = null;
        this.init();
    }

    async init() {
        // Load pdfmake library dynamically
        if (typeof pdfMake === 'undefined') {
            await this.loadPDFMake();
        }
        this.pdfMake = pdfMake;
    }

    async loadPDFMake() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js';
            script.onload = () => {
                const vfsScript = document.createElement('script');
                vfsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.min.js';
                vfsScript.onload = resolve;
                vfsScript.onerror = reject;
                document.head.appendChild(vfsScript);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    generateReport(data, language = 'tr') {
        const translations = {
            tr: {
                title: 'Depo Sayım Raporu',
                warehouse: 'Depo',
                date: 'Tarih',
                productCode: 'Ürün Kodu',
                productName: 'Ürün Adı',
                lotNumber: 'Lot No',
                quantity: 'Miktar',
                location: 'Lokasyon',
                user: 'Kullanıcı',
                totalRecords: 'Toplam Kayıt',
                totalQuantity: 'Toplam Miktar',
                generated: 'Oluşturulma',
                notes: 'Notlar',
                summary: 'Özet',
                statistics: 'İstatistikler'
            },
            en: {
                title: 'Warehouse Inventory Report',
                warehouse: 'Warehouse',
                date: 'Date',
                productCode: 'Product Code',
                productName: 'Product Name',
                lotNumber: 'Lot No',
                quantity: 'Quantity',
                location: 'Location',
                user: 'User',
                totalRecords: 'Total Records',
                totalQuantity: 'Total Quantity',
                generated: 'Generated',
                notes: 'Notes',
                summary: 'Summary',
                statistics: 'Statistics'
            },
            de: {
                title: 'Lagerbestandsbericht',
                warehouse: 'Lager',
                date: 'Datum',
                productCode: 'Produktcode',
                productName: 'Produktname',
                lotNumber: 'Losnummer',
                quantity: 'Menge',
                location: 'Standort',
                user: 'Benutzer',
                totalRecords: 'Gesamtaufzeichnungen',
                totalQuantity: 'Gesamtmenge',
                generated: 'Erstellt',
                notes: 'Notizen',
                summary: 'Zusammenfassung',
                statistics: 'Statistiken'
            }
        };

        const T = translations[language] || translations.tr;
        const now = new Date();
        const dateStr = now.toLocaleDateString(language === 'tr' ? 'tr-TR' : language === 'de' ? 'de-DE' : 'en-US');
        const timeStr = now.toLocaleTimeString(language === 'tr' ? 'tr-TR' : language === 'de' ? 'de-DE' : 'en-US');

        const { counts, warehouse, statistics } = data;
        
        // Calculate statistics
        const totalQuantity = counts.reduce((sum, count) => sum + (parseInt(count.quantity) || 0), 0);
        const uniqueProducts = new Set(counts.map(c => c.productCode)).size;
        const locationGroups = {};
        counts.forEach(count => {
            if (!locationGroups[count.location]) {
                locationGroups[count.location] = 0;
            }
            locationGroups[count.location] += parseInt(count.quantity) || 0;
        });

        const docDefinition = {
            info: {
                title: T.title,
                author: 'Warehouse Inventory System',
                subject: 'Inventory Report',
                creator: 'Depo Sayım Sistemi v3.0'
            },
            pageSize: 'A4',
            pageOrientation: 'landscape',
            pageMargins: [40, 60, 40, 60],
            header: {
                margin: [40, 20, 40, 20],
                table: {
                    widths: ['*'],
                    body: [[
                        {
                            text: T.title,
                            style: 'header',
                            alignment: 'center',
                            color: '#1a237e',
                            bold: true,
                            fontSize: 20
                        }
                    ]]
                }
            },
            footer: function(currentPage, pageCount) {
                return {
                    margin: [40, 10, 40, 10],
                    text: `${T.generated}: ${dateStr} ${timeStr} | ${currentPage}/${pageCount}`,
                    alignment: 'center',
                    fontSize: 8,
                    color: '#666'
                };
            },
            content: [
                // Summary Section
                {
                    margin: [0, 10, 0, 20],
                    table: {
                        widths: ['*', '*', '*', '*'],
                        body: [[
                            {
                                text: T.warehouse,
                                style: 'summaryLabel',
                                fillColor: '#3f51b5',
                                color: '#fff'
                            },
                            {
                                text: T.totalRecords,
                                style: 'summaryLabel',
                                fillColor: '#5c6bc0',
                                color: '#fff'
                            },
                            {
                                text: T.totalQuantity,
                                style: 'summaryLabel',
                                fillColor: '#7986cb',
                                color: '#fff'
                            },
                            {
                                text: T.statistics,
                                style: 'summaryLabel',
                                fillColor: '#9fa8da',
                                color: '#fff'
                            }
                        ], [
                            {
                                text: warehouse || 'N/A',
                                style: 'summaryValue'
                            },
                            {
                                text: statistics.total.toString(),
                                style: 'summaryValue'
                            },
                            {
                                text: totalQuantity.toString(),
                                style: 'summaryValue'
                            },
                            {
                                text: `${uniqueProducts} ${language === 'tr' ? 'farklı ürün' : language === 'de' ? 'verschiedene Produkte' : 'unique products'}`,
                                style: 'summaryValue'
                            }
                        ]]
                    }
                },

                // Main Table
                {
                    text: 'Detaylı Liste',
                    style: 'sectionHeader',
                    margin: [0, 10, 0, 10]
                },
                {
                    table: {
                        headerRows: 1,
                        widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto'],
                        body: [
                            [
                                { text: '#', style: 'tableHeader', fillColor: '#1a237e', color: '#fff' },
                                { text: T.productName, style: 'tableHeader', fillColor: '#1a237e', color: '#fff' },
                                { text: T.productCode, style: 'tableHeader', fillColor: '#1a237e', color: '#fff' },
                                { text: T.lotNumber, style: 'tableHeader', fillColor: '#1a237e', color: '#fff' },
                                { text: T.quantity, style: 'tableHeader', fillColor: '#1a237e', color: '#fff' },
                                { text: T.location, style: 'tableHeader', fillColor: '#1a237e', color: '#fff' },
                                { text: T.user, style: 'tableHeader', fillColor: '#1a237e', color: '#fff' }
                            ],
                            ...counts.map((count, index) => [
                                { text: (index + 1).toString(), style: 'tableCell' },
                                { text: count.productName || 'N/A', style: 'tableCell' },
                                { text: count.productCode || 'N/A', style: 'tableCell' },
                                { text: count.lotNumber || 'N/A', style: 'tableCell' },
                                { text: count.quantity.toString(), style: 'tableCell', alignment: 'right' },
                                { text: count.location || 'N/A', style: 'tableCell' },
                                { text: count.userName || 'N/A', style: 'tableCell' }
                            ])
                        ]
                    },
                    layout: {
                        fillColor: function (rowIndex, node, columnIndex) {
                            return (rowIndex % 2 === 0) ? '#f5f5f5' : null;
                        }
                    }
                },

                // Location Distribution
                {
                    text: 'Lokasyon Dağılımı',
                    style: 'sectionHeader',
                    margin: [0, 20, 0, 10]
                },
                {
                    table: {
                        widths: ['*', 'auto'],
                        body: [
                            [
                                { text: T.location, style: 'summaryLabel', fillColor: '#3f51b5', color: '#fff' },
                                { text: T.quantity, style: 'summaryLabel', fillColor: '#3f51b5', color: '#fff' }
                            ],
                            ...Object.entries(locationGroups).map(([location, qty]) => [
                                { text: location, style: 'tableCell' },
                                { text: qty.toString(), style: 'tableCell', alignment: 'right' }
                            ])
                        ]
                    }
                }
            ],
            styles: {
                header: {
                    fontSize: 20,
                    bold: true,
                    margin: [0, 0, 0, 10]
                },
                sectionHeader: {
                    fontSize: 14,
                    bold: true,
                    color: '#1a237e'
                },
                summaryLabel: {
                    fontSize: 10,
                    bold: true,
                    alignment: 'center'
                },
                summaryValue: {
                    fontSize: 11,
                    alignment: 'center',
                    bold: true
                },
                tableHeader: {
                    fontSize: 9,
                    bold: true,
                    alignment: 'center'
                },
                tableCell: {
                    fontSize: 8,
                    margin: [3, 3, 3, 3]
                }
            },
            defaultStyle: {
                font: 'Roboto'
            }
        };

        return this.pdfMake.createPdf(docDefinition);
    }

    async downloadReport(data, filename, language = 'tr') {
        await this.init();
        const pdfDoc = this.generateReport(data, language);
        pdfDoc.download(filename || `inventory_report_${new Date().toISOString().split('T')[0]}.pdf`);
    }

    async openReport(data, language = 'tr') {
        await this.init();
        const pdfDoc = this.generateReport(data, language);
        pdfDoc.open();
    }

    async printReport(data, language = 'tr') {
        await this.init();
        const pdfDoc = this.generateReport(data, language);
        pdfDoc.print();
    }
}

// Create singleton instance
const pdfExporter = new PDFExporter();

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = pdfExporter;
}

