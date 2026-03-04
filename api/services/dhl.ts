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
    private endpoint: string;

    constructor(user: string, signature: string, ekp: string) {
        this.user = user;
        this.signature = signature;
        this.ekp = ekp;
        // The most stable endpoint for GKV 3.1
        this.endpoint = 'https://cig.dhl.de/services/production/soap';
    }

    private getAuthHeader() {
        // Standard Basic Auth header with UTF-8 support
        const authString = `${this.user}:${this.signature}`;
        const buffer = Buffer.from(authString, 'utf8');
        return `Basic ${buffer.toString('base64')}`;
    }

    private async sendSoapRequest(action: string, bodyContent: string) {
        const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cis="http://dhl.de/webservice/cisbase" xmlns:ns="http://dhl.de/webservices/businesscustomershipping/3.0">
   <soapenv:Header>
      <cis:Authentification>
         <cis:user>${escapeXml(this.user)}</cis:user>
         <cis:signature>${escapeXml(this.signature)}</cis:signature>
      </cis:Authentification>
   </soapenv:Header>
   <soapenv:Body>
      ${bodyContent}
   </soapenv:Body>
</soapenv:Envelope>`;

        const headers: any = {
            'Content-Type': 'text/xml;charset=UTF-8',
            'SOAPAction': action,
            'User-Agent': 'Shopware/6.4.20.0 (compatible; PHP-SOAP/7.4.33)',
            'Host': 'cig.dhl.de',
            'Connection': 'Keep-Alive',
            'Authorization': this.getAuthHeader() // Always send Basic Auth for "Shipping Realm"
        };

        await logDebug('REQUEST_HEADERS', headers);
        await logDebug('REQUEST_BODY', soapEnvelope);

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers,
                body: soapEnvelope
            });

            const responseText = await response.text();
            
            await logDebug('RESPONSE_STATUS', response.status);
            await logDebug('RESPONSE_HEADERS', response.headers);
            await logDebug('RESPONSE_BODY', responseText);

            if (!response.ok) {
                // If 401, try to extract specific realm error
                if (response.status === 401) {
                    const wwwAuth = response.headers.get('www-authenticate');
                    throw new Error(`DHL Login abgelehnt (401). Server verlangt: ${wwwAuth || 'Unbekannt'}. Prüfen Sie Benutzer/Passwort.`);
                }
                
                // Try to parse SOAP Fault
                const faultMatch = responseText.match(/<faultstring>(.*?)<\/faultstring>/);
                if (faultMatch) {
                    throw new Error(`DHL API Fehler: ${faultMatch[1]}`);
                }
                
                throw new Error(`HTTP Fehler ${response.status}: ${responseText.substring(0, 200)}`);
            }

            return responseText;
        } catch (error: any) {
            await logDebug('REQUEST_ERROR', error.message);
            throw error;
        }
    }

    public async checkConnection() {
        const body = `
      <ns:GetVersionRequest>
         <majorRelease>3</majorRelease>
         <minorRelease>1</minorRelease>
      </ns:GetVersionRequest>`;
        
        const response = await this.sendSoapRequest('urn:getVersion', body);
        
        if (response.includes('majorRelease') || response.includes('ok') || response.includes('OK')) {
            return { success: true, message: 'Verbindung erfolgreich hergestellt.' };
        }
        throw new Error('Keine gültige Antwort von DHL erhalten.');
    }

    public async createLabel(order: any, sender: any) {
        // Prepare data with safe defaults
        const sequenceNumber = order.order_number || '1';
        const weight = (order.weight && parseFloat(order.weight) > 0) ? order.weight : '1.0';
        const billingNumber = this.ekp + '0101'; // Standard procedure 01 = Paket, Participation 01
        
        // Sender address
        const shipperName = sender.company || 'Maintextildruck';
        const shipperStreet = sender.street || '';
        const shipperNumber = sender.street_number || ''; // DHL expects split street/number usually
        const shipperZip = sender.zip || '';
        const shipperCity = sender.city || '';
        
        // Receiver address (Split street and number logic could be improved, but simple split is safer than nothing)
        const receiverName = `${order.first_name} ${order.last_name}`.trim() || order.customer_name;
        
        // Simple heuristic to split street and number if needed
        let recStreet = order.shipping_street || order.billing_street || '';
        let recNumber = '';
        const streetMatch = recStreet.match(/^(.+?)\s+(\d+.*)$/);
        if (streetMatch) {
            recStreet = streetMatch[1];
            recNumber = streetMatch[2];
        }

        const body = `
      <ns:CreateShipmentOrderRequest>
         <ns:Version>
            <majorRelease>3</majorRelease>
            <minorRelease>1</minorRelease>
         </ns:Version>
         <ShipmentOrder>
            <sequenceNumber>${sequenceNumber}</sequenceNumber>
            <Shipment>
               <ShipmentDetails>
                  <product>V01PAK</product>
                  <cis:accountNumber>${billingNumber}</cis:accountNumber>
                  <shipmentDate>${new Date().toISOString().split('T')[0]}</shipmentDate>
                  <ShipmentItem>
                     <weightInKG>${weight}</weightInKG>
                  </ShipmentItem>
               </ShipmentDetails>
               <Shipper>
                  <Name>
                     <cis:name1>${escapeXml(shipperName.substring(0, 35))}</cis:name1>
                  </Name>
                  <Address>
                     <cis:streetName>${escapeXml(shipperStreet)}</cis:streetName>
                     <cis:streetNumber>${escapeXml(shipperNumber)}</cis:streetNumber>
                     <cis:zip>${escapeXml(shipperZip)}</cis:zip>
                     <cis:city>${escapeXml(shipperCity)}</cis:city>
                     <cis:Origin>
                        <cis:countryISOCode>DE</cis:countryISOCode>
                     </cis:Origin>
                  </Address>
               </Shipper>
               <Receiver>
                  <cis:name1>${escapeXml(receiverName.substring(0, 35))}</cis:name1>
                  <Address>
                     <cis:streetName>${escapeXml(recStreet.substring(0, 35))}</cis:streetName>
                     <cis:streetNumber>${escapeXml(recNumber.substring(0, 10))}</cis:streetNumber>
                     <cis:zip>${escapeXml(order.shipping_zip || order.billing_zip)}</cis:zip>
                     <cis:city>${escapeXml(order.shipping_city || order.billing_city)}</cis:city>
                     <cis:Origin>
                        <cis:countryISOCode>DE</cis:countryISOCode>
                     </cis:Origin>
                  </Address>
               </Receiver>
            </Shipment>
         </ShipmentOrder>
      </ns:CreateShipmentOrderRequest>`;

        const response = await this.sendSoapRequest('urn:createShipmentOrder', body);
        
        // Extract Label URL and Tracking Number
        const labelUrlMatch = response.match(/<labelUrl>(.*?)<\/labelUrl>/);
        const trackingMatch = response.match(/<shipmentNumber>(.*?)<\/shipmentNumber>/);
        
        if (labelUrlMatch && trackingMatch) {
            return {
                success: true,
                labelUrl: labelUrlMatch[1],
                trackingNumber: trackingMatch[1]
            };
        }
        
        // Extract status message if no label
        const statusMatch = response.match(/<statusMessage>(.*?)<\/statusMessage>/);
        const error = statusMatch ? statusMatch[1] : 'Unbekannter Fehler bei der Label-Erstellung';
        throw new Error(error);
    }
}
