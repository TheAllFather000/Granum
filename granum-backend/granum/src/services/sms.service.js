const https = require('https');

const SMS_PROVIDER = (process.env.SMS_PROVIDER || 'dev').toLowerCase();

let textbeeClient = null;
let bulksmsClient = null;
let termiiClient = null;
let smsportalClient = null;

function getTextbeeClient() {
  if (!textbeeClient && SMS_PROVIDER === 'textbee') {
    const apiKey = process.env.TEXTBEE_API_KEY;
    const deviceId = process.env.TEXTBEE_DEVICE_ID;
    if (apiKey && deviceId) {
      textbeeClient = { apiKey, deviceId };
    }
  }
  return textbeeClient;
}

function getBulksmsClient() {
  if (!bulksmsClient && SMS_PROVIDER === 'bulksms') {
    const username = process.env.BULKSMS_USERNAME;
    const password = process.env.BULKSMS_PASSWORD;
    if (username && password && username !== 'your_bulksms_username') {
      bulksmsClient = { username, password };
    }
  }
  return bulksmsClient;
}

function getTermiiClient() {
  if (!termiiClient && SMS_PROVIDER === 'termii') {
    const apiKey = process.env.TERMII_API_KEY;
    const senderId = process.env.TERMII_SENDER_ID || 'LINKHIVE';
    if (apiKey && apiKey !== 'your_termii_api_key') {
      termiiClient = { apiKey, senderId };
    }
  }
  return termiiClient;
}

function getSmsportalClient() {
  if (!smsportalClient && SMS_PROVIDER === 'smsportal') {
    const username = process.env.SMSPORTAL_USERNAME;
    const password = process.env.SMSPORTAL_PASSWORD;
    if (username && password && username !== 'your_username') {
      smsportalClient = { clientId: username, clientSecret: password };
    }
  }
  return smsportalClient;
}

/**
 * Send SMS via Textbee (uses your Android phone)
 */
async function sendViaTextbee(to, body) {
  const client = getTextbeeClient();
  if (!client) return null;

  // Format phone for local/international
  let phone = to.replace(/\+/g, '').replace(/\s/g, '');
  if (!phone.startsWith('27')) phone = '27' + phone.replace(/^0/, '');

  const payload = JSON.stringify({
    recipients: [phone],
    message: body,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.textbee.dev',
      path: `/api/v1/gateway/devices/${client.deviceId}/send-sms`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': client.apiKey,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let response = '';
      res.on('data', (chunk) => response += chunk);
      res.on('end', () => {
        console.log(`[SMS] Textbee response:`, response);
        try {
          const resp = JSON.parse(response);
          // Check both top-level and nested success
          if (resp.success || resp.data?.success || resp.status === 'sent') {
            console.log(`[SMS] Textbee sent to ${phone}`);
            resolve({ status: 'sent', provider: 'textbee' });
          } else {
            reject(new Error(`Textbee: ${response}`));
          }
        } catch (e) {
          reject(new Error(`Textbee parse: ${response}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Send SMS via SMSPortal
 */
async function sendViaSmsportal(to, body) {
  const client = getSmsportalClient();
  if (!client) return null;

  const creds = Buffer.from(`${client.clientId}:${client.clientSecret}`).toString('base64');

  const payload = {
    messages: [{
      destination: to,
      content: body,
    }],
  };
  const data = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'rest.smsportal.com',
      path: '/v3/BulkMessages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${creds}`,
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let response = '';
      res.on('data', (chunk) => response += chunk);
      res.on('end', () => {
        try {
          const resp = JSON.parse(response);
          if (resp.results && resp.results[0]?.status === 'sent') {
            resolve({ status: 'sent', provider: 'smsportal' });
          } else {
            reject(new Error(`SMSPortal: ${response}`));
          }
        } catch (e) {
          reject(new Error(`SMSPortal parse: ${response}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Send SMS via BulkSMS
 */
async function sendViaBulksms(to, body) {
  const client = getBulksmsClient();
  if (!client) return null;

  let phone = to.replace(/\+/g, '').replace(/^27/, '');

  const postData = new URLSearchParams({
    username: client.username,
    password: client.password,
    msisdn: phone,
    message: body,
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.bulksms.com',
      path: '/v1/send_sms',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let response = '';
      res.on('data', (chunk) => response += chunk);
      res.on('end', () => {
        if (response.includes('0') || response.includes('queue')) {
          resolve({ status: 'sent', provider: 'bulksms' });
        } else {
          reject(new Error(`BulkSMS: ${response}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Send SMS via Termii
 */
async function sendViaTermii(to, body) {
  const client = getTermiiClient();
  if (!client) return null;

  const data = JSON.stringify({
    to: to,
    from: client.senderId,
    sms: body,
    type: 'plain',
    channel: 'generic',
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.termii.com',
      path: `/api/sms/send?api_key=${client.apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    }, (res) => {
      let bodyStr = '';
      res.on('data', (chunk) => bodyStr += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve({ status: 'sent', provider: 'termii' });
        } else {
          reject(new Error(`Termii error: ${bodyStr}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Main send SMS
 */
async function sendSMS(to, body) {
  if (SMS_PROVIDER === 'textbee') {
    try {
      return await sendViaTextbee(to, body);
    } catch (err) {
      console.error(`[SMS] Textbee failed:`, err.message);
    }
  }

  if (SMS_PROVIDER === 'smsportal') {
    try {
      return await sendViaSmsportal(to, body);
    } catch (err) {
      console.error(`[SMS] SMSPortal failed:`, err.message);
    }
  }

  if (SMS_PROVIDER === 'bulksms') {
    try {
      return await sendViaBulksms(to, body);
    } catch (err) {
      console.error(`[SMS] BulkSMS failed:`, err.message);
    }
  }

  if (SMS_PROVIDER === 'termii') {
    try {
      return await sendViaTermii(to, body);
    } catch (err) {
      console.error(`[SMS] Termii failed:`, err.message);
    }
  }

  // Dev mode
  console.log(`\n[SMS DEV] To: ${to}\n[SMS DEV] Body: ${body}\n`);
  return { sid: 'dev_mode', status: 'logged' };
}

async function sendOTP(phone, otp, purpose) {
  const messages = {
    register: `Your Granum verification code is: ${otp}\n\nValid for 5 minutes.`,
    login:    `Your Granum login code is: ${otp}\n\nValid for 5 minutes.`,
    reset:    `Your Granum password reset code is: ${otp}\n\nValid for 5 minutes.`,
  };
  const body = messages[purpose] || messages.register;
  return sendSMS(phone, body);
}

async function sendOrderConfirmation(phone, orderNumber, deliveryDate) {
  const body = `✅ Granum Order Confirmed!\nOrder: ${orderNumber}\nDelivery: ${deliveryDate}`;
  return sendSMS(phone, body);
}

async function sendVoucher(phone, code, amount, senderName) {
  const from = senderName || 'Granum';
  const body = `🎟️ Granum Voucher!\nFrom: ${from}\nR${amount}\nCode: ${code}`;
  return sendSMS(phone, body);
}

module.exports = { sendSMS, sendOTP, sendOrderConfirmation, sendVoucher };