import nodemailer from 'nodemailer';
import db from '../db.js';
import { Resend } from 'resend';
import fs from 'fs-extra';

interface EmailConfig {
    smtp_host: string;
    smtp_port: number;
    smtp_user: string;
    smtp_pass: string;
    smtp_secure: boolean;
    sender_name: string;
    sender_email: string;
    resend_api_key?: string;
    ignore_certs?: boolean;
}

const getEmailConfig = (): EmailConfig | null => {
    try {
        const config = db.prepare("SELECT * FROM email_config WHERE id = 'main'").get() as any;
        if (!config) return null;
        return {
            smtp_host: config.smtp_host,
            smtp_port: config.smtp_port || 587,
            smtp_user: config.smtp_user,
            smtp_pass: config.smtp_pass,
            smtp_secure: Boolean(config.smtp_secure),
            sender_name: config.sender_name || 'Main Textildruck',
            sender_email: config.sender_email || config.smtp_user,
            resend_api_key: config.resend_api_key,
            ignore_certs: Boolean(config.ignore_certs)
        };
    } catch (e) {
        console.error('Error fetching email config:', e);
        return null;
    }
};

export const sendOrderConfirmation = async (orderId: string, invoicePath: string) => {
    const config = getEmailConfig();
    if (!config) {
        console.warn('Email configuration missing. Skipping email sending.');
        return false;
    }

    try {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
        if (!order || !order.customer_email) {
            console.warn('Order or customer email missing.');
            return false;
        }

        // Fetch Shop Branding if available
        let branding = {
            logo_url: '',
            primary_color: '#3b82f6', // blue-500 default
            company_name: config.sender_name,
            footer_text: ''
        };

        if (order.shop_id) {
            const shop = db.prepare('SELECT logo_url, primary_color, name FROM shops WHERE id = ?').get(order.shop_id) as any;
            if (shop) {
                if (shop.logo_url && shop.logo_url.startsWith('http')) {
                    branding.logo_url = shop.logo_url;
                }
                if (shop.primary_color) branding.primary_color = shop.primary_color;
                if (shop.name) branding.company_name = shop.name;
            }
        }

        // Fetch Global Content for Footer
        const globalContent = db.prepare("SELECT * FROM global_shop_content WHERE id = 'main'").get() as any;
        if (globalContent) {
            const parts = [];
            if (globalContent.company_name) parts.push(globalContent.company_name);
            if (globalContent.company_address) parts.push(globalContent.company_address);
            if (globalContent.contact_email) parts.push(globalContent.contact_email);
            branding.footer_text = parts.join(' | ');
        }

        const subject = `Ihre Bestellung #${order.order_number} bei ${branding.company_name}`;
        
        // Professional HTML Template
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bestellbestätigung</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .header { background-color: ${branding.primary_color}; padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 40px 30px; }
        .order-info { background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid ${branding.primary_color}; }
        .order-info p { margin: 5px 0; }
        .footer { background-color: #333; color: #eee; padding: 20px; text-align: center; font-size: 12px; }
        .btn { display: inline-block; padding: 12px 24px; background-color: ${branding.primary_color}; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            ${branding.logo_url ? `<img src="${branding.logo_url}" alt="${branding.company_name}" style="max-height: 60px; max-width: 200px;">` : `<h1>${branding.company_name}</h1>`}
        </div>
        
        <div class="content">
            <h2>Vielen Dank für Ihre Bestellung!</h2>
            <p>Guten Tag ${order.customer_name},</p>
            <p>wir haben Ihre Bestellung erhalten und freuen uns, diese für Sie produzieren zu dürfen.</p>
            
            <div class="order-info">
                <p><strong>Bestellnummer:</strong> ${order.order_number}</p>
                <p><strong>Bestelldatum:</strong> ${new Date(order.created_at).toLocaleDateString('de-DE')}</p>
                <p><strong>Status:</strong> In Bearbeitung</p>
            </div>

            <p>Ihre Rechnung finden Sie als PDF-Anhang an dieser E-Mail.</p>
            
            <p>Bei Rückfragen stehen wir Ihnen gerne zur Verfügung.</p>
            
            <p>Mit freundlichen Grüßen<br>${branding.company_name}</p>
        </div>

        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${branding.company_name}</p>
            <p>${branding.footer_text}</p>
        </div>
    </div>
</body>
</html>
`;
        
        // Plain text fallback
        const text = `Guten Tag ${order.customer_name},

vielen Dank für Ihre Bestellung bei ${branding.company_name}!

Bestellnummer: ${order.order_number}
Datum: ${new Date(order.created_at).toLocaleDateString('de-DE')}

Wir haben Ihre Bestellung erhalten und bearbeiten diese schnellstmöglich.
Ihre Rechnung finden Sie als PDF im Anhang.

Mit freundlichen Grüßen
${branding.company_name}
`;

        // OPTION 1: Resend
        if (config.resend_api_key && config.resend_api_key.startsWith('re_')) {
            console.log('Sending via Resend API...');
            const resend = new Resend(config.resend_api_key);
            
            // Read PDF file for attachment
            const pdfBuffer = await fs.readFile(invoicePath);
            
            // FORCE ONBOARDING SENDER IF DOMAIN NOT MATCHING
            // Resend only allows custom sender if domain is verified.
            // To be safe, let's check if the sender email domain is 'resend.dev' or custom.
            // If custom and not working, we fallback to onboarding@resend.dev
            
            let fromAddress = `${config.sender_name} <${config.sender_email}>`;
            
            // If the user hasn't verified their domain, they MUST use onboarding@resend.dev
            // AND they can ONLY send to the email address they registered with Resend!
            // We can't know if they verified, but we can try/catch.
            
            try {
                const { data, error } = await resend.emails.send({
                    from: fromAddress,
                    to: order.customer_email,
                    subject: subject,
                    text: text,
                    html: html,
                    attachments: [
                        {
                            filename: `Rechnung_${order.order_number}.pdf`,
                            content: pdfBuffer
                        }
                    ]
                });

                if (error) {
                    console.warn('Resend failed with custom sender, trying fallback (onboarding@resend.dev)...', error.message);
                    
                    // Fallback to onboarding@resend.dev
                    const { data: fallbackData, error: fallbackError } = await resend.emails.send({
                        from: 'onboarding@resend.dev',
                        to: order.customer_email,
                        subject: subject,
                        text: text,
                        html: html,
                        attachments: [
                            {
                                filename: `Rechnung_${order.order_number}.pdf`,
                                content: pdfBuffer
                            }
                        ]
                    });

                    if (fallbackError) {
                         console.error('Resend Fallback Error:', fallbackError);
                         return false;
                    }
                    console.log('Resend Email sent (Fallback):', fallbackData?.id);
                    return true;
                }
                
                console.log('Resend Email sent:', data?.id);
                return true;
            } catch (err) {
                 console.error('Resend Exception:', err);
                 return false;
            }
        }

        // OPTION 2: SMTP (Fallback)
        if (config.smtp_host) {
            console.log('Sending via SMTP...');
            const transporter = nodemailer.createTransport({
                host: config.smtp_host,
                port: config.smtp_port,
                secure: config.smtp_secure, // true for 465, false for other ports
                auth: {
                    user: config.smtp_user,
                    pass: config.smtp_pass,
                },
                tls: {
                    rejectUnauthorized: !config.ignore_certs
                }
            });

            const info = await transporter.sendMail({
                from: `"${config.sender_name}" <${config.sender_email}>`,
                to: order.customer_email,
                subject: subject,
                text: text,
                html: html,
                attachments: [
                    {
                        filename: `Rechnung_${order.order_number}.pdf`,
                        path: invoicePath
                    }
                ]
            });

            console.log('SMTP Email sent: %s', info.messageId);
            return true;
        }
        
        console.warn('No valid email transport configured (neither Resend nor SMTP).');
        return false;

    } catch (e) {
        console.error('Error sending email:', e);
        return false;
    }
};
