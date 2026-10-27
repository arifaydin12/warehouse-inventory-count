// Advanced Barcode Scanner Utility v3.0
// Optimized for fast warehouse scanning

class BarcodeScanner {
    constructor() {
        this.isScanning = false;
        this.buffer = '';
        this.delay = 100; // Delay between keystrokes (ms)
        this.lastKeyTime = 0;
        this.callbacks = [];
    }

    // Parse barcode data
    parseBarcode(barcode, products) {
        if (!barcode || barcode.length < 12) {
            return null;
        }

        // Try to find product by barcode
        const product = products.find(p => p.barcode === barcode || p.code === barcode);
        
        if (product) {
            return {
                found: true,
                productCode: product.code,
                productName: product.name,
                lotNumber: this.extractLotNumber(barcode),
                category: product.category,
                unit: product.unit
            };
        }

        // Try to extract product code from barcode
        const productCode = this.extractProductCode(barcode);
        const lotNumber = this.extractLotNumber(barcode);

        return {
            found: false,
            productCode: productCode,
            productName: 'Unknown Product',
            lotNumber: lotNumber,
            category: 'Unknown',
            unit: 'PCS'
        };
    }

    // Extract product code from barcode
    extractProductCode(barcode) {
        // Try different patterns
        // Pattern 1: First 9 digits
        if (barcode.length >= 9) {
            return barcode.substring(0, 9);
        }
        return barcode;
    }

    // Extract lot number from barcode
    extractLotNumber(barcode) {
        // Pattern: Last 4-6 characters
        if (barcode.length >= 12) {
            return barcode.substring(barcode.length - 6);
        }
        return barcode.substring(barcode.length - 4);
    }

    // Register callback for barcode events
    onScan(callback) {
        this.callbacks.push(callback);
    }

    // Simulate barcode scanner input
    simulateBarcodeInput(element, barcode) {
        if (!element) return;
        
        const event = new Event('input', { bubbles: true });
        element.value = barcode;
        element.dispatchEvent(event);
        
        if (element.onChange) {
            element.onChange({ target: { value: barcode } });
        }
    }

    // Initialize keyboard barcode scanner
    initKeyboardScanner(element) {
        if (!element) return;

        element.addEventListener('keypress', (e) => {
            const now = Date.now();
            
            // Reset buffer if too much time passed
            if (now - this.lastKeyTime > this.delay * 3) {
                this.buffer = '';
            }
            
            this.lastKeyTime = now;
            
            // Accumulate characters
            if (e.key === 'Enter') {
                if (this.buffer.length >= 8) {
                    this.callbacks.forEach(cb => cb(this.buffer));
                }
                this.buffer = '';
            } else if (e.key.length === 1) {
                this.buffer += e.key;
            }
        });
    }

    // QR Code detection
    detectQRCode(data) {
        if (data && data.includes('|')) {
            const parts = data.split('|');
            return {
                isQR: true,
                productCode: parts[0] || '',
                lotNumber: parts[1] || '',
                quantity: parts[2] || '1',
                location: parts[3] || ''
            };
        }
        return { isQR: false };
    }

    // Generate QR code data string
    generateQRData(productCode, lotNumber, quantity, location) {
        return `${productCode}|${lotNumber}|${quantity}|${location}`;
    }

    // Format barcode for display
    formatBarcode(barcode) {
        if (!barcode) return '';
        
        // Format EAN-13 barcode (13 digits with spacing)
        if (barcode.length === 13 && /^\d+$/.test(barcode)) {
            return `${barcode.substring(0, 1)} ${barcode.substring(1, 7)} ${barcode.substring(7, 13)}`;
        }
        
        // Format regular barcode
        if (barcode.length > 12) {
            return barcode.match(/.{1,4}/g).join(' ');
        }
        
        return barcode;
    }

    // Validate barcode format
    validateBarcode(barcode) {
        if (!barcode || barcode.length < 4) {
            return { valid: false, reason: 'Barcode too short' };
        }
        
        if (barcode.length > 50) {
            return { valid: false, reason: 'Barcode too long' };
        }
        
        return { valid: true };
    }

    // Quick scan mode - auto-submit on valid barcode
    enableQuickScan(element, onSubmit) {
        let lastInput = '';
        let timeout = null;

        if (!element) return;

        element.addEventListener('input', (e) => {
            const value = e.target.value;
            
            clearTimeout(timeout);
            
            timeout = setTimeout(() => {
                // Check if input changed significantly (scanner finished reading)
                if (value.length >= 8 && lastInput !== value) {
                    onSubmit(value);
                    element.value = '';
                }
                lastInput = value;
            }, 300);
        });
    }

    // Batch scan mode - collect multiple scans
    startBatchScan() {
        this.batchScans = [];
        this.isBatchScanning = true;
    }

    addToBatch(barcode) {
        if (this.isBatchScanning) {
            this.batchScans.push({
                barcode,
                timestamp: new Date().toISOString()
            });
        }
    }

    endBatchScan() {
        this.isBatchScanning = false;
        return this.batchScans;
    }

    // Analytics
    getScanStats() {
        return {
            totalScans: this.batchScans?.length || 0,
            averageScanTime: this.averageScanTime || 0,
            successRate: this.successRate || 100
        };
    }
}

// Create singleton instance
const barcodeScanner = new BarcodeScanner();

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = barcodeScanner;
}

