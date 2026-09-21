import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Content, Part } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set. Requests will fail if no key is provided.");
    }
    aiClient = new GoogleGenAI({ apiKey: apiKey || '' });
  }
  return aiClient;
}

const isTextBased = (mimeType: string) => {
  return (
    mimeType === 'text/csv' ||
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/xml' ||
    mimeType.includes('javascript') ||
    mimeType.includes('typescript') ||
    mimeType.includes('script')
  );
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Verify custom API key endpoint
  app.post('/api/verify-key', async (req, res) => {
    try {
      const apiKey = (req.body?.apiKey || '').trim();
      if (!apiKey) {
        return res.status(400).json({ valid: false, error: 'API anahtarı boş olamaz.' });
      }
      if (apiKey.length < 15) {
        return res.status(400).json({ valid: false, error: 'Geçersiz API anahtarı formatı (karakter sayısı yetersiz).' });
      }

      const testAi = new GoogleGenAI({ apiKey });
      const testResponse = await testAi.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'ping',
      });

      if (testResponse.text) {
        return res.json({ 
          valid: true, 
          message: 'Google Gemini API anahtarı başarıyla doğrulandı ve çalışıyor!' 
        });
      }
      return res.json({ valid: true, message: 'API anahtarı geçerli.' });
    } catch (err: any) {
      let errorDetails = err.message || 'API anahtarı doğrulanamadı.';
      try {
        const parsed = typeof err.message === 'string' ? JSON.parse(err.message) : err.message;
        if (parsed?.error?.message) {
          errorDetails = parsed.error.message;
        }
      } catch {}
      return res.status(400).json({ valid: false, error: errorDetails });
    }
  });

  // Chat completion streaming endpoint
  app.post('/api/chat', async (req, res) => {
    const { 
      prompt, 
      attachments = [], 
      history = [], 
      thinkingBudget = 0, 
      isAgentMode = false, 
      agentSpecialty = 'general', 
      memories = [],
      customApiKey
    } = req.body;

    // Set streaming headers
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      // Determine AI client: Prioritize user-provided key if supplied
      const trimmedCustomKey = typeof customApiKey === 'string' ? customApiKey.trim() : '';
      const hasCustomKey = trimmedCustomKey.length >= 10;
      
      const clientCandidates: { name: string; client: GoogleGenAI }[] = [];
      if (hasCustomKey) {
        clientCandidates.push({
          name: 'Kişisel API Anahtarı',
          client: new GoogleGenAI({ apiKey: trimmedCustomKey })
        });
      }
      // Add default server client
      clientCandidates.push({
        name: 'Sistem API Anahtarı',
        client: getAIClient()
      });

      const currentDate = new Date().toLocaleDateString("tr-TR", { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      let memoryPromptSection = "";
      if (Array.isArray(memories) && memories.length > 0) {
        memoryPromptSection = `\n[LONG-TERM APPLICATION MEMORY & USER CONTEXT - DO NOT FORGET]:\n` +
          memories.map((m: any) => `- [${(m.category || 'GENEL').toUpperCase()}] ${m.key}: ${m.value}`).join("\n") +
          `\n[END LONG-TERM MEMORY]\nApply this user memory naturally without repeating it verbatim unless asked.\n`;
      }

      let agentInstructions = "";
      if (isAgentMode) {
        let specialtyDetail = "";
        if (agentSpecialty === 'research') {
          specialtyDetail = `Focus on comprehensive multi-angle research, fact-checking, deep inquiry, syntheses, citations, and critical analytical comparisons.`;
        } else if (agentSpecialty === 'coder') {
          specialtyDetail = `Focus on clean, production-ready, typed software architecture, debugging root causes, robust error handling, security, and algorithmic performance.`;
        } else if (agentSpecialty === 'analyst') {
          specialtyDetail = `Focus on quantitative, tabular data analysis, pattern identification, business metrics, trends, and strategic takeaways.`;
        } else {
          specialtyDetail = `Operate as an autonomous proactive agent: analyze the objective, formulate a clear step-by-step strategy, execute meticulously, and provide actionable deliverables.`;
        }

        agentInstructions = `
[AGENT MODE ACTIVE - ROLE & EXECUTION DIRECTIVE]:
You are running in Autonomous Agent Mode (${(agentSpecialty || 'general').toUpperCase()} SPECIALTY).
${specialtyDetail}

Operational Structure:
When solving tasks or answering queries in Agent Mode:
1. Clearly identify the core objective.
2. Outline your structured action plan with distinct milestones (e.g. 🎯 Hedef, 🔍 Analiz / İnceleme, 🛠️ Uygulama & Adımlar, 📋 Sonuç & Öneriler).
3. If code or data is requested, provide complete, production-ready, runnable solutions.
4. Maintain a proactive, highly intelligent, and authoritative tone in Turkish.
`;
      }

      const systemInstruction = `
You are Mustafa AI, a powerful, state-of-the-art AI assistant and Agent powered by Google's Gemini models.
Today's date is ${currentDate}.

${memoryPromptSection}
${agentInstructions}

Core Guidelines:
- Primary language is Turkish (unless the user explicitly addresses you in another language).
- Address the user respectfully (User: Mustafa).
- Your knowledge is up-to-date with today's date (${currentDate}).
- Be articulate, comprehensive, well-formatted (using Markdown, tables, code blocks where appropriate).
      `.trim();

      // Format previous history
      const formattedHistory: Content[] = history
        .filter((msg: any) => !msg.isError)
        .map((msg: any) => {
          const parts: Part[] = [{ text: msg.text || '' }];
          if (msg.attachments && msg.attachments.length > 0) {
            msg.attachments.forEach((att: any) => {
              if (isTextBased(att.mimeType)) {
                try {
                  const decodedText = Buffer.from(att.data, 'base64').toString('utf-8');
                  parts.push({
                    text: `\n[EKLENEN DOSYA: ${att.name} (${att.mimeType})]:\n${decodedText}\n[DOSYA SONU]\n`
                  });
                } catch {
                  parts.push({
                    inlineData: {
                      mimeType: att.mimeType,
                      data: att.data
                    }
                  });
                }
              } else {
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
            role: msg.role === 'user' ? 'user' : 'model',
            parts: parts
          };
        });

      // Current prompt parts
      const currentParts: Part[] = [];
      if (prompt && prompt.trim()) {
        currentParts.push({ text: prompt });
      }

      if (attachments && attachments.length > 0) {
        attachments.forEach((att: any) => {
          if (isTextBased(att.mimeType)) {
            try {
              const decodedText = Buffer.from(att.data, 'base64').toString('utf-8');
              currentParts.push({
                text: `\n[EKLENEN DOSYA: ${att.name} (${att.mimeType})]:\n${decodedText}\n[DOSYA SONU]\n`
              });
            } catch {
              currentParts.push({
                inlineData: {
                  mimeType: att.mimeType,
                  data: att.data
                }
              });
            }
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

      const contents: Content[] = [
        ...formattedHistory,
        {
          role: 'user',
          parts: currentParts.length > 0 ? currentParts : [{ text: 'Merhaba' }]
        }
      ];

      // Model candidate list for automatic resilient fallback
      // Ordered by capability and high-throughput availability
      const candidateModels = [
        'gemini-3.7-flash',
        'gemini-flash-latest',
        'gemini-3.1-flash-lite',
      ];

      let streamSuccess = false;
      let lastError: any = null;

      for (const clientCand of clientCandidates) {
        if (streamSuccess) break;
        const ai = clientCand.client;

        for (const modelToTry of candidateModels) {
          try {
            const geminiConfig: any = {
              systemInstruction: systemInstruction,
              temperature: isAgentMode ? 0.4 : 0.7,
            };

            // Configure thinking budget if specified and positive
            if (typeof thinkingBudget === 'number' && thinkingBudget > 0 && modelToTry.includes('3.7-flash')) {
              geminiConfig.thinkingConfig = {
                thinkingBudget: thinkingBudget
              };
            }

            const responseStream = await ai.models.generateContentStream({
              model: modelToTry,
              contents: contents,
              config: geminiConfig,
            });

            let chunkCount = 0;
            for await (const chunk of responseStream) {
              if (chunk.text) {
                res.write(chunk.text);
                chunkCount++;
              }
            }

            if (chunkCount > 0) {
              streamSuccess = true;
              break; // Stream completed successfully
            }
          } catch (err: any) {
            console.warn(`[${clientCand.name}] Model ${modelToTry} attempt failed:`, err.message || err);
            lastError = err;
            // Attempt next candidate model in list
          }
        }
      }

      if (!streamSuccess) {
        let userFriendlyMsg = "Yapay zeka servisine şu anda erişilemedi. Ayarlar menüsünden 'Gemini API Anahtarı' bölümünü açarak kendi ücretsiz Google Gemini anahtarınızı tanımlayabilirsiniz.";
        if (lastError?.message) {
          try {
            const parsed = typeof lastError.message === 'string' ? JSON.parse(lastError.message) : lastError.message;
            if (parsed?.error?.message) {
              userFriendlyMsg = parsed.error.message;
            }
          } catch {
            userFriendlyMsg = lastError.message;
          }
        }
        res.write(`\n[Sistem Mesajı]: ${userFriendlyMsg}`);
      }

      res.end();
    } catch (err: any) {
      console.error("Chat API error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "Internal server error" });
      } else {
        res.write(`\n[Sunucu Hatası]: ${err.message || 'Bilinmeyen bir hata oluştu.'}`);
        res.end();
      }
    }
  });

  // Development vs Production serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mustafa AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
