/**
 * Cloudflare Email Worker → Zammad Integration
 * Receives emails via Cloudflare Email Routing and creates tickets in Zammad
 *
 * Setup:
 * 1. Deploy this worker to Cloudflare
 * 2. Set up Email Routing to send to this worker
 * 3. Configure environment variables in Cloudflare dashboard
 */

export default {
  async email(message, env, ctx) {
    try {
      // Parse email
      const email = await parseEmail(message);

      console.log(`📧 Received email from ${email.from} to ${email.to}`);

      // Create Zammad ticket
      const ticket = await createZammadTicket(email, env);

      if (ticket) {
        console.log(`✅ Created Zammad ticket #${ticket.id}`);
      }

      // Forward to personal email (optional)
      if (env.FORWARD_TO) {
        await message.forward(env.FORWARD_TO);
      }

    } catch (error) {
      console.error('❌ Error processing email:', error);
      // Still forward the email even if Zammad creation fails
      if (env.FORWARD_TO) {
        await message.forward(env.FORWARD_TO);
      }
    }
  }
};

/**
 * Parse email message into structured object
 */
async function parseEmail(message) {
  const rawEmail = await new Response(message.raw).text();

  return {
    from: message.from,
    to: message.to,
    subject: message.headers.get('subject'),
    text: await message.text(),
    html: await message.html() || null,
    headers: Object.fromEntries(message.headers),
    rawEmail: rawEmail
  };
}

/**
 * Create a ticket in Zammad via API
 */
async function createZammadTicket(email, env) {
  const ZAMMAD_URL = env.ZAMMAD_URL || 'https://help.vln.gg';
  const ZAMMAD_API_TOKEN = env.ZAMMAD_API_TOKEN;

  if (!ZAMMAD_API_TOKEN) {
    console.warn('⚠️  ZAMMAD_API_TOKEN not configured');
    return null;
  }

  try {
    // Extract customer info
    const customerEmail = email.from;
    const customerName = extractName(email.from) || customerEmail.split('@')[0];

    // Find or create customer
    const customer = await findOrCreateCustomer(ZAMMAD_URL, ZAMMAD_API_TOKEN, {
      email: customerEmail,
      firstname: customerName.split(' ')[0] || customerName,
      lastname: customerName.split(' ').slice(1).join(' ') || ''
    });

    // Create ticket
    const ticketData = {
      title: email.subject || '(No Subject)',
      group: 'Users',
      customer_id: customer.id,
      article: {
        subject: email.subject || '(No Subject)',
        body: email.text || email.html || '',
        type: 'email',
        sender: 'Customer',
        from: customerEmail,
        to: email.to,
        content_type: email.html ? 'text/html' : 'text/plain',
        internal: false
      },
      priority: '2 normal',
      state: 'new'
    };

    const response = await fetch(`${ZAMMAD_URL}/api/v1/tickets`, {
      method: 'POST',
      headers: {
        'Authorization': `Token token=${ZAMMAD_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ticketData)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to create ticket:', error);
      return null;
    }

    return await response.json();

  } catch (error) {
    console.error('Error creating Zammad ticket:', error);
    return null;
  }
}

/**
 * Find or create customer in Zammad
 */
async function findOrCreateCustomer(baseUrl, apiToken, customerData) {
  try {
    // Search for existing customer
    const searchUrl = `${baseUrl}/api/v1/users/search?query=${encodeURIComponent(customerData.email)}`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Token token=${apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (searchResponse.ok) {
      const results = await searchResponse.json();
      if (results && results.length > 0) {
        return results[0];
      }
    }

    // Create new customer
    const createResponse = await fetch(`${baseUrl}/api/v1/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Token token=${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...customerData,
        roles: ['Customer']
      })
    });

    if (!createResponse.ok) {
      throw new Error('Failed to create customer');
    }

    return await createResponse.json();

  } catch (error) {
    console.error('Error finding/creating customer:', error);
    throw error;
  }
}

/**
 * Extract name from email address
 */
function extractName(emailAddress) {
  const match = emailAddress.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : null;
}
