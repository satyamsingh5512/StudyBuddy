import { getGroqClient } from '../lib/groqClient.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * AI Orchestrator implementing Graceful Degradation
 * Attempts to use Groq API (Llama 3.3). If it fails/times out, falls back to Gemini Pro.
 */

let geminiClient: GoogleGenerativeAI | null = null;
const getGeminiClient = () => {
    if (!geminiClient) {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not configured');
        }
        geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return geminiClient;
};

export interface AIChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AIResponse {
    response: string;
    provider: 'groq' | 'gemini';
}

export const generateAIResponse = async (
    messages: AIChatMessage[],
    temperature = 0.7,
    maxTokens = 1024
): Promise<AIResponse> => {
    try {
        // 1. Try Groq First (Primary Provider)
        if (process.env.GROQ_API_KEY) {
            const groq = getGroqClient();
            console.log('🤖 AI Orchestrator: Attempting Groq (Primary)...');

            // Use AbortController for timeout (Groq occasionally hangs)
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

            try {
                const completion = await groq.chat.completions.create({
                    messages: messages as any,
                    model: 'llama-3.3-70b-versatile',
                    temperature,
                    max_tokens: maxTokens,
                });
                clearTimeout(timeout);
                return {
                    response: completion.choices[0]?.message?.content || '',
                    provider: 'groq'
                };
            } catch (err: any) {
                clearTimeout(timeout);
                console.error('❌ Groq generation failed or timed out:', err.message);
                // Fall through to Gemini
            }
        }
    } catch (error) {
        console.error('❌ Groq initialization failed:', error);
    }

    // 2. Fallback to Gemini Pro (Secondary Provider)
    if (process.env.GEMINI_API_KEY) {
        try {
            console.log('🤖 AI Orchestrator: Falling back to Gemini Pro...');
            const genAI = getGeminiClient();
            const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

            // Convert messages to Gemini format
            // Gemini separates system instructions differently, but we'll prepend them to the first user message
            // for simplicity if needed, or use the dedicated system API format.
            const systemMessages = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
            const standardMessages = messages.filter(m => m.role !== 'system');

            let contents = [];
            let currentRole = 'user'; // Gemini requires starting with user
            let currentText = systemMessages ? `System Instructions:\n${systemMessages}\n\n` : '';

            // Consolidate messages for Gemini
            for (const msg of standardMessages) {
                const geminiRole = msg.role === 'assistant' ? 'model' : 'user';
                if (geminiRole === currentRole) {
                    currentText += `\n${msg.content}`;
                } else {
                    contents.push({ role: currentRole, parts: [{ text: currentText }] });
                    currentRole = geminiRole;
                    currentText = msg.content;
                }
            }
            if (currentText) {
                contents.push({ role: currentRole, parts: [{ text: currentText }] });
            }

            // Ensure the first message is 'user'
            if (contents[0]?.role !== 'user') {
                contents.unshift({ role: 'user', parts: [{ text: systemMessages || 'Hello' }] });
            }

            const result = await model.generateContent({
                contents,
                generationConfig: {
                    temperature,
                    maxOutputTokens: maxTokens,
                },
            });

            const response = result.response.text();
            return { response, provider: 'gemini' };
        } catch (err: any) {
            console.error('❌ Gemini fallback failed:', err);
            throw new Error('Both primary (Groq) and fallback (Gemini) AI providers failed.');
        }
    }

    throw new Error('No AI providers configured. Please set GROQ_API_KEY or GEMINI_API_KEY.');
};
