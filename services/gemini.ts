import { GoogleGenAI, Content, Part } from "@google/genai";
import { GeminiConfig, Message, Attachment } from "../types";


const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates content using the Gemini 3 Pro model within a chat session using streaming.
 * @param prompt The user's input prompt.
 * @param attachments Optional file attachments for the prompt.
 * @param history The previous chat history (excluding the current prompt).
 * @param config Configuration options (e.g., thinking budget).
 */
export const generateContentStream = async function* (
  prompt: string, 
  attachments: Attachment[], 
  history: Message[], 
  config: GeminiConfig
): AsyncGenerator<string, void, unknown> {
  try {
  
    const currentDate = new Date().toLocaleDateString("tr-TR", { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    const systemInstruction = `
      You are Gemini 3.0 Pro, a next-generation AI model created by Google.
      Today's date is ${currentDate}.
      
      Your knowledge cutoff is NOT 2024. You are aware of the current date provided above.
      Always answer in the language the user speaks (mostly Turkish).
      If asked about your version, state clearly that you are Gemini 3.0 Pro.
    `;

    // Helper to determine if an attachment should be treated as text (included in prompt)
    // or binary inlineData (images, PDF, audio, video)
    const isTextBased = (mimeType: string) => {
        return mimeType === 'text/csv' || 
               mimeType.startsWith('text/') || 
               mimeType === 'application/json' ||
               mimeType === 'application/xml' ||
               mimeType.includes('javascript') ||
               mimeType.includes('typescript') ||
               mimeType.includes('script');
    };

    // Map existing messages to Gemini Content format for the history
    const formattedHistory: Content[] = history
      .filter(msg => !msg.isError)
      .map(msg => {
        const parts: Part[] = [{ text: msg.text }];
        if (msg.attachments && msg.attachments.length > 0) {
            msg.attachments.forEach(att => {
                // If it's a text-based attachment (CSV, Code, JSON, XML), decode and add as text
                if (isTextBased(att.mimeType)) {
                    const decodedText = decodeURIComponent(escape(atob(att.data)));
                    parts.push({
                         text: `\n[Attachment: ${att.name}]\n${decodedText}\n[End Attachment]\n`
                    });
                } else {
                    // Images, PDF, Video, Audio
                    parts.push({
                        inlineData: {
                            mimeType: att.mimeType,
                            data: att.data
                        }
                    });
                }
            });
        }
        return {
            role: msg.role === 'user' ? 'user' : 'model', // SDK genelde 'model' bekler, verindeki role yapısına dikkat et
            parts: parts,
        };
      });

    // 3. CHAT OTURUMUNU BAŞLATIRKEN SYSTEM INSTRUCTION'I EKLE
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview', // Model isminin doğruluğundan emin ol (örn: gemini-2.0-flash-thinking-exp vb. olabilir)
      history: formattedHistory,
      config: {
        systemInstruction: systemInstruction, // <-- EKLENEN KISIM
        thinkingConfig: {
          thinkingBudget: config.thinkingBudget > 0 ? config.thinkingBudget : 0,
        },
      },
    });

    // Prepare current message parts
    const currentParts: Part[] = [];
    
    // Add attachments if any
    if (attachments && attachments.length > 0) {
        attachments.forEach(att => {
            if (isTextBased(att.mimeType)) {
                const decodedText = decodeURIComponent(escape(atob(att.data)));
                currentParts.push({
                     text: `\n[Attachment: ${att.name}]\n${decodedText}\n[End Attachment]\n`
                });
            } else {
                currentParts.push({
                    inlineData: {
                        mimeType: att.mimeType,
                        data: att.data
                    }
                });
            }
        });
    }

    // Add text if present (Gemini requires at least one part)
    if (prompt) {
        currentParts.push({ text: prompt });
    } else if (currentParts.length === 0) {
        // Fallback if no input provided at all (rare, but prevents API error)
        currentParts.push({ text: " " });
    }

    // Since chat.sendMessageStream expects a string 'message' OR 'content' (which can be parts),
    // Construct the payload correctly for the SDK
    const result = await chat.sendMessageStream({ 
        message: currentParts 
    });
    
    for await (const chunk of result) {
      if (chunk.text) {
        yield chunk.text;
      }
    }

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message) {
        throw new Error(`Gemini API Error: ${error.message}`);
    }
    throw new Error("An unexpected error occurred while communicating with Gemini.");
  }
};
