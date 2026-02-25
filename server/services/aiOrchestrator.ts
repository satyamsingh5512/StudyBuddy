import { GoogleGenerativeAI } from '@google/generative-ai';

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
    provider: 'gemini';
}

export const generateAIResponse = async (
    messages: AIChatMessage[],
    temperature = 0.7,
    maxTokens = 1024
): Promise<AIResponse> => {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('No AI providers configured. Please set GEMINI_API_KEY.');
    }

    try {
        console.log('🤖 AI Orchestrator: Generating via Gemini...');
        const genAI = getGeminiClient();
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Convert messages to Gemini format
        const systemMessages = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
        const standardMessages = messages.filter(m => m.role !== 'system');

        const contents = [];
        let currentRole = 'user'; // Gemini requires starting with user
        let currentText = systemMessages ? `System Instructions:\n${systemMessages}\n\n` : '';

        // Consolidate messages for Gemini
        for (const msg of standardMessages) {
            const geminiRole = msg.role === 'assistant' ? 'model' : 'user';
            if (geminiRole === currentRole) {
                currentText += `\n${msg.content}`;
            } else {
                if (currentText) {
                    contents.push({ role: currentRole, parts: [{ text: currentText }] });
                }
                currentRole = geminiRole;
                currentText = msg.content;
            }
        }
        if (currentText) {
            contents.push({ role: currentRole, parts: [{ text: currentText }] });
        }

        // Ensure the first message is 'user' and not empty
        if (contents.length === 0 || contents[0]?.role !== 'user') {
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
        console.error('❌ Gemini generation failed:', err);
        throw new Error('Gemini AI generation failed.');
    }
};
