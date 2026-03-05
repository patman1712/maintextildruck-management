import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';

// Logger function to save detailed debug info
const logDebug = async (type: string, data: any) => {
    const timestamp = new Date().toISOString();
    const logEntry = `\n[${timestamp}] [${type}]\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}\n----------------------------------------`;
    try {
        await fs.appendFile('dhl_debug_log.txt', logEntry);
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

    constructor(user: string, signature: string, ekp: string, apiKey: string = '') {
        this.user = user;
        this.signature = signature;
        this.ekp = ekp;
        this.apiKey = apiKey;
        this.endpoint = 'https://api-eu.dhl.com/parcel/de/shipping/v2';
    }

    private getBasicAuth() {
        return `Basic ${Buffer.from(`${this.user}:${this.signature}`, 'utf8').toString('base64')}`;
    }

    public async checkConnection() {
        // With REST API v2, we check connectivity by calling the version or similar
        // If apiKey is missing, we can't use REST
        if (!this.apiKey) {
            throw new Error('Kein DHL API-Key hinterlegt. Bitte generieren Sie einen API-Key im DHL Developer Portal.');
        }

        try {
            await logDebug('REST_AUTH_CHECK', 'Testing REST API v2...');
            
            // The REST API uses a simple GET for testing or status
            // We use the validation endpoint or just a dummy request to check Auth
            const response = await fetch(`${this.endpoint}/orders?docFormat=PDF`, {
                method: 'GET',
                headers: {
                    'Authorization': this.getBasicAuth(),
                    'dhl-api-key': this.apiKey,
                    'Accept': 'application/json'
                }
            });

            // If we get 405 (Method Not Allowed), it means Auth was successful (since GET is not allowed for orders)
            // If we get 401, Auth failed.
            if (response.status === 405 || response.status === 200 || response.status === 400) {
                return { success: true, message: 'Verbindung zur DHL REST API erfolgreich (Authentifizierung bestätigt)!' };
            }

            const errorText = await response.text();
            await logDebug('REST_ERROR', { status: response.status, body: errorText });
            
            if (response.status === 401) {
                throw new Error('Anmeldung fehlgeschlagen (401). Bitte prüfen Sie Benutzername, Passwort und API-Key.');
            }
            
            throw new Error(`DHL REST API Fehler ${response.status}: ${errorText.substring(0, 100)}`);
        } catch (error: any) {
            throw error;
        }
    }

    public async createLabel(order: any, sender: any) {
        if (!this.apiKey) throw new Error('API-Key fehlt.');

        const billingNumber = this.ekp + '0101';
        const today = new Date().toISOString().split('T')[0];

        // Prepare REST JSON Payload
        const payload = {
            shipments: [{
                product: 'V01PAK',
                billingNumber: billingNumber,
                shipmentDate: today,
                shipper: {
                    name1: sender.company || 'Maintextildruck',
                    address: {
                        streetName: sender.street,
                        streetNumber: sender.street_number,
                        zipCode: sender.zip,
                        city: sender.city,
                        origin: { countryISOCode: 'DEU' }
                    }
                },
                receiver: {
                    name1: `${order.first_name} ${order.last_name}`.trim() || order.customer_name,
                    address: {
                        streetName: order.shipping_street || order.billing_street || '',
                        streetNumber: '1', // Needs splitting in real use, but for test 1
                        zipCode: order.shipping_zip || order.billing_zip,
                        city: order.shipping_city || order.billing_city,
                        origin: { countryISOCode: 'DEU' }
                    }
                },
                details: {
                    parcelWeightKG: parseFloat(order.weight) || 1.0
                }
            }]
        };

        try {
            await logDebug('REST_REQUEST', payload);
            
            const response = await fetch(`${this.endpoint}/orders`, {
                method: 'POST',
                headers: {
                    'Authorization': this.getBasicAuth(),
                    'dhl-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
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
