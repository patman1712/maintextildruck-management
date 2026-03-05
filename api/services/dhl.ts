import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';

// Logger function to save detailed debug info
const logDebug = async (type: string, data: any) => {
    const timestamp = new Date().toISOString();
    const logEntry = `\n[${timestamp}] [${type}]\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}\n----------------------------------------`;
    try {
        await fs.appendFile(path.join(process.cwd(), 'dhl_debug.log'), logEntry);
    } catch (e) {
        console.error('Failed to write debug log', e);
    }
};

const escapeXml = (unsafe: string) => {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&"']/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '"': return '&quot;';
            case "'": return '&apos;';
            default: return c;
        }
    });
};

export class DhlClient {
    private user: string;
    private signature: string;
    private ekp: string;
    private apiKey: string; // New: For REST API 2.0
    private endpoint: string;
    private participation: string;

    constructor(user: string, signature: string, ekp: string, apiKey: string = '', sandbox: boolean = false, participation: string = '01') {
        this.user = user;
        this.signature = signature;
        this.ekp = ekp;
        this.apiKey = apiKey;
        this.participation = participation;
        this.endpoint = sandbox 
            ? 'https://api-sandbox.dhl.com/parcel/de/shipping/v2'
            : 'https://api-eu.dhl.com/parcel/de/shipping/v2';
        
        console.log(`DHL Client initialized with Sandbox: ${sandbox}, Endpoint: ${this.endpoint}`);
    }

    private getBasicAuth() {
        return `Basic ${Buffer.from(`${this.user}:${this.signature}`, 'utf8').toString('base64')}`;
    }

    private splitStreet(address: string) {
        if (!address) return { name: '', number: '' };
        
        // Simple regex for German addresses: Last digits are number
        const match = address.match(/^(.+?)\s*(\d+(?:[a-zA-Z])?(?:[-/]\d+(?:[a-zA-Z])?)?)$/);
        if (match) {
            return { name: match[1].trim(), number: match[2].trim() };
        }
        
        // Fallback: If no number found, put everything in name and '1' in number (bad, but better than crash)
        // Ideally we should try to extract number differently or let user fix it
        return { name: address, number: '1' };
    }

    public async checkConnection() {
        // With REST API v2, we check connectivity by calling the version or similar
        // If apiKey is missing, we can't use REST
        if (!this.apiKey) {
            throw new Error('Kein DHL API-Key hinterlegt. Bitte generieren Sie einen API-Key im DHL Developer Portal.');
        }

        try {
            await logDebug('REST_AUTH_CHECK', {
                endpoint: this.endpoint,
                user: this.user,
                // signature: '***', // Don't log signature
                apiKey: this.apiKey ? this.apiKey.substring(0, 5) + '...' : 'missing',
                authHeader: this.getBasicAuth().substring(0, 15) + '...'
            });
            
            // The REST API uses a simple GET for testing or status
            // We use the validation endpoint or just a dummy request to check Auth
            // Try simpler request: just /orders with limit 1
            const response = await fetch(`${this.endpoint}/orders?limit=1`, {
                method: 'GET',
                headers: {
                    'Authorization': this.getBasicAuth(),
                    'dhl-api-key': this.apiKey,
                    'Accept': 'application/json'
                }
            });

            const responseText = await response.text();
            await logDebug('REST_AUTH_RESPONSE', { 
                status: response.status, 
                headers: JSON.stringify(response.headers.raw()),
                body: responseText 
            });

            // If we get 405 (Method Not Allowed), it means Auth was successful (since GET is not allowed for orders)
            // If we get 401, Auth failed.
            if (response.status === 405 || response.status === 200 || response.status === 400 || response.status === 404) {
                 // Even 404 might mean Auth worked but no orders found (depending on API)
                 // But typically 401 is the only "Auth Failed" status.
                return { success: true, message: 'Verbindung zur DHL REST API erfolgreich (Authentifizierung bestätigt)!' };
            }
            
            if (response.status === 401) {
                throw new Error(`Anmeldung fehlgeschlagen (401). Details: ${responseText}`);
            }
            
            throw new Error(`DHL REST API Fehler ${response.status}: ${responseText.substring(0, 200)}`);
        } catch (error: any) {
            await logDebug('REST_AUTH_ERROR', error.message);
            throw error;
        }
    }

    public async createLabel(order: any, sender: any) {
        if (!this.apiKey) throw new Error('API-Key fehlt.');

        const billingNumber = this.ekp + this.participation + '01'; // EKP(10) + Procedure(01) + Participation(01) -> usually 14 chars. Wait, Standard is EKP(10) + Procedure(2) + Participation(2)
        // Standard procedure for "Paket" is '01'. Participation is often '01'.
        // Let's assume procedure is fixed to '01' (DHL Paket) unless we want to support others.
        // Billing Number format: 14 digits.
        // 1-10: EKP
        // 11-12: Procedure (01 = Paket V01PAK)
        // 13-14: Participation (Teilnahme)
        
        const finalBillingNumber = `${this.ekp}01${this.participation}`;

        const today = new Date().toISOString().split('T')[0];

        // Split street and number for receiver
        const receiverStreetFull = order.shipping_street || order.billing_street || '';
        const receiverAddress = this.splitStreet(receiverStreetFull);

        // Ensure weights are valid numbers
        let weight = parseFloat(order.weight) || 1.0;
        if (weight <= 0) weight = 1.0;

        // Ensure proper types for street numbers
        const shipperStreetNumber = sender.street_number ? String(sender.street_number) : '1';
        const receiverStreetNumber = receiverAddress.number ? String(receiverAddress.number) : '1';

        // Prepare REST JSON Payload
        const payload = {
            shipments: [{
                product: 'V01PAK',
                billingNumber: finalBillingNumber,
                shipmentDate: today,
                shipper: {
                    name1: (sender.company || 'Maintextildruck').substring(0, 35),
                    address: {
                        streetName: (sender.street || '').substring(0, 35),
                        streetNumber: shipperStreetNumber.substring(0, 5),
                        zipCode: (sender.zip || '').substring(0, 10),
                        city: (sender.city || '').substring(0, 35),
                        origin: { countryISOCode: 'DEU' }
                    }
                },
                receiver: {
                    name1: (`${order.first_name} ${order.last_name}`.trim() || order.customer_name || 'Kunde').substring(0, 35),
                    address: {
                        streetName: (receiverAddress.name || '').substring(0, 35),
                        streetNumber: receiverStreetNumber.substring(0, 5),
                        zipCode: (order.shipping_zip || order.billing_zip || '').substring(0, 10),
                        city: (order.shipping_city || order.billing_city || '').substring(0, 35),
                        origin: { countryISOCode: 'DEU' }
                    }
                },
                details: {
                    dim: {
                        uom: 'mm',
                        height: 100,
                        length: 200,
                        width: 150
                    },
                    weight: {
                        uom: 'kg',
                        value: weight
                    }
                }
            }]
        };

        try {
            await logDebug('REST_REQUEST', payload);
            
            const response = await fetch(`${this.endpoint}/orders?docFormat=PDF&printFormat=A4`, { // Add print params
                method: 'POST',
                headers: {
                    'Authorization': this.getBasicAuth(),
                    'dhl-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                // If not JSON, it's likely a raw HTML error page from 500
                await logDebug('REST_RESPONSE_RAW', responseText);
                throw new Error(`DHL Server Fehler (${response.status}): ${responseText.substring(0, 200)}`);
            }

            await logDebug('REST_RESPONSE', data);

            if (!response.ok) {
                const errorMsg = data.detail || data.title || 'Fehler bei der REST API';
                throw new Error(errorMsg);
            }

            const shipment = data.shipments[0];
            if (shipment.validationMessages) {
                // Check if there are hard errors
                const hardErrors = shipment.validationMessages.filter((m: any) => m.validationState === 'ERROR');
                if (hardErrors.length > 0) {
                    throw new Error(hardErrors[0].validationMessage);
                }
            }

            return {
                success: true,
                labelUrl: shipment.label.url,
                trackingNumber: shipment.shipmentNumber
            };

        } catch (error: any) {
            await logDebug('REST_EXCEPTION', error.message);
            throw error;
        }
    }
}
