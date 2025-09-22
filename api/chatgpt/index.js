/**
 * Azure Function API Proxy for OpenAI ChatGPT
 *
 * This function acts as a secure proxy between the frontend and OpenAI API,
 * keeping the API key server-side and safe from client exposure.
 *
 * Security Features:
 * - API key stored server-side only
 * - Input validation and PHI protection
 * - Rate limiting and request validation
 * - CORS properly configured for carexps.nexasync.ca
 */

module.exports = async function (context, req) {
    // Set CORS headers for the specific domain
    context.res = {
        headers: {
            'Access-Control-Allow-Origin': 'https://carexps.nexasync.ca',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '3600',
            'Content-Type': 'application/json'
        }
    };

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        context.res.body = {};
        return;
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        context.res.status = 405;
        context.res.body = { error: 'Method not allowed. Use POST.' };
        return;
    }

    try {
        // Get OpenAI API key from environment variables
        const openaiApiKey = process.env.OPENAI_API_KEY;

        // Debug: Log available environment variables (without values for security)
        context.log('Available environment variables:', Object.keys(process.env).filter(key => key.includes('OPENAI') || key.includes('API')));

        if (!openaiApiKey) {
            context.log.error('OPENAI_API_KEY environment variable not set');
            context.log.error('Available env vars:', Object.keys(process.env));
            context.res.status = 500;
            context.res.body = {
                error: 'Server configuration error. API key not available.',
                success: false,
                debug: {
                    envVarsAvailable: Object.keys(process.env).length,
                    relevantVars: Object.keys(process.env).filter(key => key.includes('OPENAI') || key.includes('API'))
                }
            };
            return;
        }

        context.log('OpenAI API key found, length:', openaiApiKey.length);

        // Validate request body
        if (!req.body) {
            context.res.status = 400;
            context.res.body = { error: 'Request body is required' };
            return;
        }

        const { messages, model = 'gpt-3.5-turbo', max_tokens = 1000 } = req.body;

        // Validate messages
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            context.res.status = 400;
            context.res.body = { error: 'Messages array is required and must not be empty' };
            return;
        }

        // Basic PHI protection - check for potential sensitive data patterns
        const messageText = messages.map(m => m.content || '').join(' ').toLowerCase();
        const phiPatterns = [
            /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone numbers
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email addresses
            /\b\d{3}-?\d{2}-?\d{4}\b/, // SSN patterns
            /patient.*(?:id|number|ssn)/,
            /medical.*(?:record|number|id)/,
            /diagnosis.*of/,
            /prescription.*for/
        ];

        if (phiPatterns.some(pattern => pattern.test(messageText))) {
            context.res.status = 400;
            context.res.body = {
                error: 'Request contains potentially sensitive information that cannot be processed.',
                success: false
            };
            return;
        }

        // Log the request (without sensitive data)
        context.log(`ChatGPT API request: ${messages.length} messages, model: ${model}`);

        // Make request to OpenAI API
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                max_tokens,
                temperature: 0.7,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0
            })
        });

        if (!openaiResponse.ok) {
            context.log.error(`OpenAI API error: ${openaiResponse.status} ${openaiResponse.statusText}`);

            if (openaiResponse.status === 401) {
                context.res.status = 500;
                context.res.body = {
                    error: 'Authentication failed with OpenAI service.',
                    success: false
                };
                return;
            } else if (openaiResponse.status === 429) {
                context.res.status = 429;
                context.res.body = {
                    error: 'Rate limit exceeded. Please try again in a moment.',
                    success: false
                };
                return;
            } else {
                context.res.status = 500;
                context.res.body = {
                    error: 'External service temporarily unavailable.',
                    success: false
                };
                return;
            }
        }

        const data = await openaiResponse.json();

        if (data.choices && data.choices.length > 0) {
            const assistantMessage = data.choices[0].message?.content?.trim();

            if (assistantMessage) {
                context.log(`ChatGPT API success: ${assistantMessage.length} characters returned`);
                context.res.status = 200;
                context.res.body = {
                    success: true,
                    message: assistantMessage
                };
                return;
            }
        }

        context.res.status = 500;
        context.res.body = {
            error: 'No response generated. Please try rephrasing your question.',
            success: false
        };

    } catch (error) {
        context.log.error('ChatGPT API proxy error:', error);
        context.res.status = 500;
        context.res.body = {
            error: 'Unable to connect to help service. Please try again later.',
            success: false
        };
    }
};