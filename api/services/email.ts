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

        const subject = `Ihre Bestellung #${order.order_number} bei ${config.sender_name}`;
        const text = `Guten Tag ${order.customer_name},

vielen Dank für Ihre Bestellung!

Bestellnummer: ${order.order_number}
Datum: ${new Date(order.created_at).toLocaleDateString('de-DE')}

Im Anhang finden Sie Ihre Rechnung als PDF.

Mit freundlichen Grüßen
${config.sender_name}
`;

        const html = `
            <h2>Vielen Dank für Ihre Bestellung!</h2>
            <p>Guten Tag ${order.customer_name},</p>
            <p>wir haben Ihre Bestellung erhalten und bearbeiten diese schnellstmöglich.</p>
            <ul>
                <li><strong>Bestellnummer:</strong> ${order.order_number}</li>
                <li><strong>Datum:</strong> ${new Date(order.created_at).toLocaleDateString('de-DE')}</li>
            </ul>
            <p>Im Anhang finden Sie Ihre Rechnung als PDF.</p>
            <br>
            <p>Mit freundlichen Grüßen<br>${config.sender_name}</p>
        `;

        // OPTION 1: Resend
        if (config.resend_api_key && config.resend_api_key.startsWith('re_')) {
            console.log('Sending via Resend API...');
            const resend = new Resend(config.resend_api_key);
            
            // Read PDF file for attachment
            const pdfBuffer = await fs.readFile(invoicePath);
            
            const { data, error } = await resend.emails.send({
                from: `${config.sender_name} <${config.sender_email}>`,
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
                console.error('Resend Error:', error);
                return false;
            }
            console.log('Resend Email sent:', data?.id);
            return true;
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
