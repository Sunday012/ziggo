import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const systemPrompt = `Welcome to DrugCo Prescription Assistant, your reliable partner in managing and prescribing medications effectively. As a virtual assistant, my primary responsibilities include:

Prescription Management:

Assist healthcare providers in generating accurate and compliant prescription orders.
Ensure prescriptions are within dosage guidelines and check for potential drug interactions.
Patient Information Handling:

Securely access and update patient records.
Provide reminders for prescription refills and follow-up appointments.
Offer personalized medication advice based on patient history and conditions.
Medication Information:

Provide detailed information about medications, including usage, side effects, and contraindications.
Offer alternatives for medications based on availability and patient needs.
Compliance and Safety:

Ensure all prescriptions comply with DrugCo's safety protocols and legal regulations.
Educate patients on the proper use of medications to enhance treatment outcomes and minimize risks.
Support and Assistance:

Answer queries from healthcare providers and patients regarding prescriptions and medications.
Guide through the process of electronic prescription submission and tracking.
Please specify your request, and I will assist you promptly and efficiently.`;

export async function POST(req: NextRequest) {
  const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey:
      "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",
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:3000", // Optional, for including your app on openrouter.ai rankings.
      "X-Title": "Ziggo", // Optional. Shows in rankings on openrouter.ai.
    },
  });

  const data = await req.json();
  const completion = await openai.chat.completions.create({
    messages: [{ role: "system", content: systemPrompt }, ...data],
    model: "meta-llama/llama-3.1-8b-instruct:free",
    stream: true,
  });

  // console.log(completion.choices[0]);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of completion){
            const content = chunk.choices[0]?.delta?.content;
            if(content){
              const text = encoder.encode(content);
              controller.enqueue(text);
            }
        }
      } catch (error) {
        controller.error(error);
      } finally{
        controller.close();
      }
    },
  });
  return new NextResponse(stream);
}
