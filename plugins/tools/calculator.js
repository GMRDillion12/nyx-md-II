// Safe math expression evaluator
function evaluateExpression(expr) {
    // Remove spaces for processing
    expr = expr.replace(/\s+/g, '');
    
    // Comprehensive validation: only allow numbers, operators, and parentheses
    if (!/^[\d+\-*/(). ]*$/.test(expr)) {
        throw new Error('Invalid characters in expression');
    }
    
    // Prevent common injection attempts
    if (/[a-zA-Z_$@#&]/.test(expr)) {
        throw new Error('Letters and special characters not allowed');
    }
    
    // Check for balanced parentheses
    let parenCount = 0;
    for (const char of expr) {
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
        if (parenCount < 0) throw new Error('Unbalanced parentheses');
    }
    if (parenCount !== 0) throw new Error('Unbalanced parentheses');
    
    // Prevent division by zero ahead of time by checking pattern
    if (/\/\s*0(?![0-9])/.test(expr)) {
        throw new Error('Division by zero');
    }
    
    // Use Function constructor in a controlled, safe way
    try {
        const func = new Function('return ' + expr);
        const result = func();
        
        // Validate result
        if (!isFinite(result)) {
            throw new Error('Result is not a valid number');
        }
        
        return result;
    } catch (err) {
        if (err.message.includes('return')) {
            throw new Error('Invalid mathematical expression');
        }
        throw err;
    }
}

module.exports = {
    command: ['calc'],
    category: 'tools',
    description: 'Perform safe mathematical calculations',
    usage: '.calc <expression>',

    async execute(sock, m, args, config) {
        const chat = m.chat || m.key?.remoteJid;

        // Validate input
        if (!args || args.length === 0) {
            return sock.sendMessage(chat, {
                text: '❌ Usage: `.calc <expression>`\n\n' +
                      '📋 *Examples:*\n' +
                      '• `.calc 5 + 3`\n' +
                      '• `.calc 10 * 2 - 5`\n' +
                      '• `.calc (100 + 50) / 3`\n' +
                      '• `.calc 2 ^ 8` (power)\n\n' +
                      '✅ *Allowed:* Numbers, +, -, *, /, (), decimals\n' +
                      '❌ *Not allowed:* Letters, variables, functions'
            }, { quoted: m });
        }

        const expression = args.join(' ').trim();

        // Basic length check
        if (expression.length > 500) {
            return sock.sendMessage(chat, {
                text: '❌ Expression too long! Maximum 500 characters.'
            }, { quoted: m });
        }

        // Check for empty or invalid start
        if (!expression || /^[+/*)]/.test(expression)) {
            return sock.sendMessage(chat, {
                text: '❌ Invalid expression format. Cannot start with operator.'
            }, { quoted: m });
        }

        try {
            const result = evaluateExpression(expression);

            // Format the result
            let formattedResult = result;
            if (typeof result === 'number') {
                // Limit decimal places to 10
                if (!Number.isInteger(result)) {
                    formattedResult = parseFloat(result.toFixed(10));
                }
            }

            const text = `🧮 *Calculator*\n\n` +
                       `📝 *Expression:* \`${expression}\`\n` +
                       `✅ *Result:* \`${formattedResult}\``;

            await sock.sendMessage(chat, {
                text: text
            }, { quoted: m });

            // React with success
            await sock.sendMessage(chat, {
                react: { text: '✅', key: m.key }
            });

        } catch (error) {
            let errorMsg = '❌ ';
            
            if (error.message.includes('Division by zero')) {
                errorMsg += 'Cannot divide by zero!';
            } else if (error.message.includes('Unbalanced parentheses')) {
                errorMsg += 'Parentheses are not balanced!';
            } else if (error.message.includes('Invalid characters')) {
                errorMsg += 'Only numbers and operators (+, -, *, /, ()) allowed!';
            } else if (error.message.includes('Invalid mathematical')) {
                errorMsg += 'Invalid mathematical expression!';
            } else {
                errorMsg += error.message || 'Failed to calculate expression.';
            }

            await sock.sendMessage(chat, {
                text: errorMsg + '\n\nTry: `.calc 5 + 3 * 2`'
            }, { quoted: m });
        }
    }
};
