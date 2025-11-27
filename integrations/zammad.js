/**
 * Zammad API Integration
 * Creates tickets in Zammad from incoming emails
 */

const axios = require('axios');

class ZammadIntegration {
  constructor(config) {
    this.baseUrl = config.ZAMMAD_URL || 'https://help.vln.gg';
    this.apiToken = config.ZAMMAD_API_TOKEN;
    this.enabled = config.ZAMMAD_ENABLED !== 'false';

    if (!this.apiToken && this.enabled) {
      console.warn('⚠️  Zammad API token not configured. Set ZAMMAD_API_TOKEN in .env');
      this.enabled = false;
    }

    this.client = axios.create({
      baseURL: `${this.baseUrl}/api/v1`,
      headers: {
        'Authorization': `Token token=${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  }

  /**
   * Create a ticket in Zammad from an email
   * @param {Object} email - Email object with from, to, subject, body, etc.
   * @param {Object} domainConfig - Domain-specific configuration
   * @returns {Promise<Object>} Created ticket
   */
  async createTicket(email, domainConfig = {}) {
    if (!this.enabled) {
      console.log('Zammad integration disabled');
      return null;
    }

    try {
      const zammadConfig = domainConfig.zammad || {};

      // Extract customer info
      const customerEmail = email.from.address || email.from;
      const customerName = email.from.name || customerEmail.split('@')[0];

      // Find or create customer
      let customer = await this.findOrCreateCustomer({
        email: customerEmail,
        firstname: customerName.split(' ')[0] || customerName,
        lastname: customerName.split(' ').slice(1).join(' ') || ''
      });

      // Create ticket
      const ticketData = {
        title: email.subject || '(No Subject)',
        group: zammadConfig.group || 'Users',
        customer_id: customer.id,
        article: {
          subject: email.subject || '(No Subject)',
          body: email.body || email.text || '',
          type: 'email',
          sender: 'Customer',
          from: customerEmail,
          to: email.to,
          content_type: email.html ? 'text/html' : 'text/plain'
        },
        priority: zammadConfig.priority || '2 normal',
        state: 'new'
      };

      // Add tags if specified
      if (domainConfig.rules && domainConfig.rules.length > 0) {
        const matchingRule = this.findMatchingRule(email, domainConfig.rules);
        if (matchingRule && matchingRule.action.tags) {
          ticketData.tags = matchingRule.action.tags.join(',');
        }
      }

      console.log(`📧 Creating Zammad ticket for: ${customerEmail}`);
      const response = await this.client.post('/tickets', ticketData);

      console.log(`✅ Created Zammad ticket #${response.data.id}`);
      return response.data;

    } catch (error) {
      console.error('❌ Failed to create Zammad ticket:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Find or create a customer in Zammad
   */
  async findOrCreateCustomer(customerData) {
    try {
      // Try to find existing customer
      const searchResponse = await this.client.get('/users/search', {
        params: { query: customerData.email }
      });

      if (searchResponse.data && searchResponse.data.length > 0) {
        return searchResponse.data[0];
      }

      // Create new customer
      const createResponse = await this.client.post('/users', {
        ...customerData,
        roles: ['Customer']
      });

      return createResponse.data;

    } catch (error) {
      console.error('❌ Failed to find/create customer:', error.message);
      throw error;
    }
  }

  /**
   * Find matching rule for email
   */
  findMatchingRule(email, rules) {
    for (const rule of rules) {
      let matches = true;

      if (rule.match.toContains) {
        const toField = (email.to || '').toLowerCase();
        matches = matches && rule.match.toContains.some(keyword =>
          toField.includes(keyword.toLowerCase())
        );
      }

      if (rule.match.subjectContains) {
        const subject = (email.subject || '').toLowerCase();
        matches = matches && rule.match.subjectContains.some(keyword =>
          subject.includes(keyword.toLowerCase())
        );
      }

      if (matches) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Test connection to Zammad
   */
  async testConnection() {
    if (!this.enabled) {
      return { success: false, error: 'Zammad integration disabled' };
    }

    try {
      const response = await this.client.get('/users/me');
      return {
        success: true,
        user: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ZammadIntegration;
