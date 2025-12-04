
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "./constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const TEXT_MODEL = "gemini-2.5-flash";
const EDIT_IMAGE_MODEL = "gemini-2.5-flash-image"; // Best for multimodal editing
const GENERATE_IMAGE_MODEL = "gemini-3-pro-image-preview"; // Best for high quality generation

export interface GeminiResponse {
  text: string;
  generatedImage?: string; // base64
}

export const sendMessageToGemini = async (
  prompt: string,
  imageBase64?: string,
  history: { role: string; parts: { text: string }[] }[] = [],
  imageSize: '1K' | '2K' | '4K' = '1K'
): Promise<GeminiResponse> => {
  try {
    const trimmedPrompt = prompt.trim();
    
    // 1. Check for Image Generation Intent (Text -> Image)
    const isImageGen = /^(ارسم|draw|generate|create image|صورة لـ|تخيل)/i.test(trimmedPrompt);
    
    // 2. Check for Image Editing Intent (Image + Text -> Image)
    // Keywords implying modification of the attached image
    const isImageEdit = imageBase64 && /^(غير|عدل|حول|اضف|احذف|اجعل|change|edit|modify|add|remove|make|style|filter|background)/i.test(trimmedPrompt);

    if (isImageGen && !imageBase64) {
      // Use Gemini 3 Pro Image Preview for Generation
      const response = await ai.models.generateContent({
        model: GENERATE_IMAGE_MODEL,
        contents: {
          parts: [{ text: trimmedPrompt }]
        },
        config: {
            imageConfig: {
                imageSize: imageSize,
            }
        }
      });

      let generatedImage = null;
      let textResponse = "تم توليد الصورة الفاخرة بناءً على طلبك.";

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          generatedImage = `data:image/png;base64,${part.inlineData.data}`;
        } else if (part.text) {
            textResponse = part.text;
        }
      }

      return {
        text: textResponse,
        generatedImage: generatedImage || undefined
      };

    } else if (isImageEdit && imageBase64) {
      // Use Gemini 2.5 Flash Image for Editing
      const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
      
      const response = await ai.models.generateContent({
        model: EDIT_IMAGE_MODEL,
        contents: {
            parts: [
                { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
                { text: trimmedPrompt }
            ]
        }
      });

      let generatedImage = null;
      let textResponse = "تم تعديل الصورة.";

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          generatedImage = `data:image/png;base64,${part.inlineData.data}`;
        } else if (part.text) {
            textResponse = part.text;
        }
      }

      return {
        text: textResponse,
        generatedImage: generatedImage || undefined
      };

    } else {
      // 3. Standard Text/Multimodal Chat Processing (Analysis)
      const parts: any[] = [{ text: trimmedPrompt }];

      if (imageBase64) {
        const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
        parts.unshift({
          inlineData: {
            mimeType: "image/jpeg",
            data: cleanBase64,
          },
        });
        
        // Use generateContent for multimodal input (Flash handles this well)
        const response = await ai.models.generateContent({
            model: TEXT_MODEL,
            contents: { parts: parts },
            config: { systemInstruction: SYSTEM_INSTRUCTION }
        });
        
        return { text: response.text || "عذراً، لم أستطع تحليل الصورة." };
      } 
      
      // Text Only Chat
      const validHistory = history.map(h => ({
        role: h.role,
        parts: h.parts
      }));

      const chat = ai.chats.create({
        model: TEXT_MODEL,
        history: validHistory,
        config: { systemInstruction: SYSTEM_INSTRUCTION }
      });

      const response = await chat.sendMessage({ message: trimmedPrompt });
      return { text: response.text || "حدث خطأ غير متوقع." };
    }

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
