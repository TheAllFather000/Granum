const nodemailer = require('nodemailer');

// ── transporter (lazy init) ───────────────────────────────────
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass || user.includes('your_')) {
    return null; // not configured — dev fallback
  }

  transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth:   { user, pass },
  });

  return transporter;
}

// ── base email wrapper ────────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
  const t = getTransporter();

  if (!t) {
    console.log(`\n[EMAIL DEV] To: ${to}`);
    console.log(`[EMAIL DEV] Subject: ${subject}`);
    console.log(`[EMAIL DEV] Body preview: ${(text || '').slice(0, 120)}...\n`);
    return { messageId: 'dev_mode' };
  }

  try {
    const info = await t.sendMail({
      from:    process.env.EMAIL_FROM || 'Granum <noreply@linkhive.co.za>',
      to, subject, html, text,
    });
    console.log(`[Email] Sent to ${to} — ID: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`[Email] Failed to ${to}:`, err.message);
    throw err;
  }
}

// ── shared layout wrapper ─────────────────────────────────────
function layout(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>Granum</title>
</head>
<body style="margin:0;padding:0;background:#FDFAF6;font-family:'DM Sans',Arial,sans-serif;color:#2E2C28">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FDFAF6;padding:32px 16px">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px">

      <!-- header -->
      <tr><td style="background:#4A6B3C;border-radius:14px 14px 0 0;padding:24px 32px">
        <a href="https://linkhive.co.za" style="text-decoration:none">
          <span style="font-family:Georgia,serif;font-size:22px;font-weight:900;color:#FFFFFF">
            Link<span style="color:rgba(255,255,255,.6)">hive</span>
          </span>
        </a>
      </td></tr>

      <!-- body -->
      <tr><td style="background:#FFFFFF;padding:32px;border-left:1px solid rgba(60,55,45,.1);border-right:1px solid rgba(60,55,45,.1)">
        ${content}
      </td></tr>

      <!-- footer -->
      <tr><td style="background:#F2EEE7;border-radius:0 0 14px 14px;padding:20px 32px;border:1px solid rgba(60,55,45,.08)">
        <p style="font-size:12px;color:#7A776F;margin:0;line-height:1.6">
          Granum (Pty) Ltd &nbsp;·&nbsp; Cape Town, South Africa<br/>
          This is a transactional email. You received it because you placed an order on Granum.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── helper: format cents as Rands ─────────────────────────────
function rands(cents) {
  return 'R' + (cents / 100).toFixed(2).replace(/\.00$/, '');
}

// ── ORDER CONFIRMATION ────────────────────────────────────────
async function sendOrderConfirmationEmail(to, order) {
  const {
    order_number, first_name, delivery_name, delivery_address,
    delivery_area, delivery_province, delivery_date,
    delivery_notes, payment_method, subtotal_cents,
    discount_cents, delivery_cents, total_cents, items = [],
  } = order;

  const formattedDate = new Date(delivery_date).toLocaleDateString('en-ZA', {
    weekday:'long', year:'numeric', month:'long', day:'numeric',
  });

  const itemRows = items.map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #F2EEE7;font-size:14px;color:#2E2C28">
        ${item.product_name} ${item.qty > 1 ? `<span style="color:#7A776F">×${item.qty}</span>` : ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #F2EEE7;font-size:14px;color:#2E2C28;text-align:right;font-weight:600">
        ${rands(item.subtotal_cents)}
      </td>
    </tr>`).join('');

  const paymentLabels = {
    card:             'Debit / Credit card',
    eft:              'EFT / Bank transfer',
    cash_on_delivery: 'Cash on delivery',
    snapscan:         'SnapScan',
    voucher:          'Granum voucher',
  };

  const html = layout(`
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:900;color:#2E2C28;margin:0 0 6px">
      Order confirmed! 🎉
    </h1>
    <p style="font-size:15px;color:#7A776F;margin:0 0 28px;line-height:1.6">
      Hi ${first_name}, your order has been placed and the suppliers have been notified.
    </p>

    <!-- order number badge -->
    <div style="background:#EAF3DE;border-radius:10px;padding:14px 18px;margin-bottom:28px;display:inline-block">
      <span style="font-size:12px;font-weight:700;color:#3A552E;text-transform:uppercase;letter-spacing:.6px">
        Order number
      </span><br/>
      <span style="font-family:Georgia,serif;font-size:22px;font-weight:900;color:#4A6B3C">
        ${order_number}
      </span>
    </div>

    <!-- items table -->
    <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#7A776F;margin:0 0 12px">
      Items ordered
    </h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
      ${itemRows}
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#7A776F">Subtotal</td>
        <td style="padding:8px 0;font-size:13px;color:#7A776F;text-align:right">${rands(subtotal_cents)}</td>
      </tr>
      ${discount_cents > 0 ? `
      <tr>
        <td style="padding:4px 0;font-size:13px;color:#4A6B3C">Discount</td>
        <td style="padding:4px 0;font-size:13px;color:#4A6B3C;text-align:right;font-weight:600">−${rands(discount_cents)}</td>
      </tr>` : ''}
      <tr>
        <td style="padding:4px 0;font-size:13px;color:#7A776F">Delivery</td>
        <td style="padding:4px 0;font-size:13px;color:#7A776F;text-align:right">${rands(delivery_cents)}</td>
      </tr>
      <tr>
        <td style="padding:12px 0 0;font-size:16px;font-weight:700;color:#2E2C28;border-top:2px solid #EAF3DE">
          Total
        </td>
        <td style="padding:12px 0 0;text-align:right;border-top:2px solid #EAF3DE">
          <span style="font-family:Georgia,serif;font-size:20px;font-weight:900;color:#4A6B3C">${rands(total_cents)}</span>
        </td>
      </tr>
    </table>

    <!-- delivery + payment details -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="50%" valign="top" style="padding-right:16px">
          <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#7A776F;margin:0 0 10px">
            Delivering to
          </h3>
          <p style="font-size:14px;color:#2E2C28;margin:0;line-height:1.7">
            <strong>${delivery_name}</strong><br/>
            ${delivery_address}<br/>
            ${delivery_area ? delivery_area + ', ' : ''}${delivery_province}
            ${delivery_notes ? `<br/><em style="color:#7A776F;font-size:13px">${delivery_notes}</em>` : ''}
          </p>
        </td>
        <td width="50%" valign="top" style="padding-left:16px">
          <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#7A776F;margin:0 0 10px">
            Expected delivery
          </h3>
          <p style="font-size:14px;color:#2E2C28;margin:0 0 14px;line-height:1.7;font-weight:600">
            📅 ${formattedDate}
          </p>
          <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#7A776F;margin:0 0 6px">
            Payment
          </h3>
          <p style="font-size:14px;color:#2E2C28;margin:0">
            ${paymentLabels[payment_method] || payment_method}
          </p>
        </td>
      </tr>
    </table>

    <div style="background:#F5EDE0;border-radius:10px;padding:14px 18px;margin-top:28px">
      <p style="font-size:13px;color:#5C3D22;margin:0;line-height:1.6">
        <strong>What happens next?</strong><br/>
        Your suppliers have been notified and will prepare your order. 
        You'll receive an SMS when your delivery is on the way.
        For any issues, reply to this email or WhatsApp us.
      </p>
    </div>
  `);

  const text = `
Granum — Order Confirmed

Hi ${first_name},

Your order ${order_number} has been placed.

Items: ${items.map(i => `${i.product_name} x${i.qty} — ${rands(i.subtotal_cents)}`).join(', ')}
Total: ${rands(total_cents)}

Delivering to: ${delivery_name}, ${delivery_address}, ${delivery_province}
Expected: ${formattedDate}
Payment: ${paymentLabels[payment_method] || payment_method}

Questions? Email hello@linkhive.co.za
`.trim();

  return sendEmail({
    to,
    subject: `Order confirmed — ${order_number} 🎉`,
    html,
    text,
  });
}

// ── ORDER STATUS UPDATE ───────────────────────────────────────
async function sendOrderStatusEmail(to, order, newStatus) {
  const statusMessages = {
    confirmed: {
      emoji: '✅', heading: 'Your order is confirmed',
      body: 'Great news — your order has been confirmed by the suppliers and is being prepared.',
    },
    out_for_delivery: {
      emoji: '🚚', heading: 'Your order is on the way!',
      body: 'Your delivery driver has picked up your order and is heading to your spaza. Expect arrival soon.',
    },
    delivered: {
      emoji: '🎉', heading: 'Order delivered!',
      body: 'Your order has been marked as delivered. We hope everything arrived in perfect condition.',
    },
    cancelled: {
      emoji: '❌', heading: 'Order cancelled',
      body: 'Your order has been cancelled. If this was unexpected, please contact us immediately.',
    },
  };

  const msg = statusMessages[newStatus];
  if (!msg) return;

  const html = layout(`
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:900;color:#2E2C28;margin:0 0 6px">
      ${msg.emoji} ${msg.heading}
    </h1>
    <p style="font-size:15px;color:#7A776F;margin:0 0 24px;line-height:1.6">
      Hi ${order.first_name}, here's an update on order <strong>${order.order_number}</strong>.
    </p>
    <div style="background:#EAF3DE;border-radius:10px;padding:18px;margin-bottom:24px">
      <p style="font-size:15px;color:#3A552E;margin:0;line-height:1.6">${msg.body}</p>
    </div>
    <p style="font-size:14px;color:#7A776F;margin:0">
      Order number: <strong style="color:#2E2C28">${order.order_number}</strong><br/>
      Total: <strong style="color:#4A6B3C">${rands(order.total_cents)}</strong>
    </p>
  `);

  return sendEmail({
    to,
    subject: `${msg.emoji} ${msg.heading} — ${order.order_number}`,
    html,
    text: `${msg.heading}\n\nOrder: ${order.order_number}\n${msg.body}`,
  });
}

module.exports = { sendEmail, sendOrderConfirmationEmail, sendOrderStatusEmail, rands };
