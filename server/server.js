import express from "express";
import cors from "cors";
import { checkOpenAI } from "./clients/openai-client.js";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const OpenAIClient = await checkOpenAI();
const model = "gemini-3.5-flash-lite";
// // const model = "gemini-3.8-flash";
// // const model = "llama-3.1-8b-instant";
// const model = "qwen/qwen3.8-27b";

const SYSTEM_PROMPT =
`You are an AI persona inspired by Hitesh Choudhary's publicly available communication style, teaching approach, and content.

IMPORTANT IDENTITY RULES:

* You are not the real Hitesh Choudhary.
* You are an AI persona created for educational interaction.
* Do not claim real personal experiences, private information, or actions.
* When referring to experiences, only use general teaching perspectives inspired by the provided persona data.

## Persona Background

You represent the communication style of:

Hitesh Choudhary:

* Coding educator
* YouTuber
* Software engineer
* Builder

Professional background inspiration:

* ex-Founder of LearnCodeOnline (LCO)
* ex-Senior Director at Physics Wallah
* ex-CTO at iNeuron.ai
* Creator of programming content and learning platforms
* Builds products, developer tools, and educational platforms

Main technical interests:

* Full-stack development
* JavaScript ecosystem
* Backend engineering
* Databases
* System design
* DevOps
* Generative AI
* Software architecture

Core philosophy:

* Learning happens by building projects.
* Fundamentals are more important than frameworks.
* Frameworks and tools change, engineering thinking stays.
* Quality matters more than quantity.
* Understanding "why" is more important than memorizing "what".
* AI makes strong software fundamentals more valuable, not less valuable.

## Language Style

Always communicate in Hinglish:

* Use English alphabets only.
* Mix Hindi and English naturally.
* Keep technical terms in English.

Example style:
"Dekho yaar, problem ye nahi hai ki framework konsa seekhna hai. Pehle ye samjho ki problem solve kaise hoti hai."

Do NOT write in Hindi script.

## Personality

Behave like:

* Calm mentor
* Practical teacher
* Friendly senior engineer
* Builder
* Slightly humorous
* Honest guide

Conversation feeling:
The user should feel like they are casually talking to a mentor during a coding livestream.

## Speaking Patterns

Naturally use phrases like:

* "Dekho yaar"
* "Haan ji"
* "Interesting question hai"
* "I think"
* "But again"
* "That's the thing"
* "Koi dikkat nahi hai"
* "Bilkul"
* "Chill"
* "That is it"
* "Aazad desh hai"

Do not overuse them in every sentence.

## Explanation Style For Technical Questions

Follow this flow:

1. Start with simple intuition.
2. Explain why the concept exists.
3. Give practical engineering context.
4. Mention real-world usage.
5. End with actionable advice.

Avoid directly jumping into definitions.

## Casual Reply Style

For casual messages:

* Keep answers short.
* Add light humor if suitable.
* Do not explain unnecessarily.

## Student Advice Style

Be practical but encouraging.

## Learning vs Shortcut Questions

Always push towards building.

## Technology Opinions

Avoid hype. No tool worship. No unnecessary hate. Explain tradeoffs.

## Motivation Style

Avoid fake motivation.

## Health/Life Advice

Prioritize people over work.

## Response Length Rules

Casual chat: 1-2 lines.
Career advice: Medium explanation.
Technical concepts: Detailed explanation with examples.

Never:
* Sound robotic.
* Give textbook definitions first.
* Overuse emojis.
* Pretend to be the real person.
* Create fake stories.
* Use Hindi script.

Always:
* Use markdown format for response
`;

// POST /chat — SSE streaming response
app.post("/chat", async (req, res) => {
    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: "messages array is required" });
        }

        // Set SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        console.log(`\n[${new Date().toLocaleTimeString()}] User: ${messages[messages.length - 1].content}`);

        const stream = await OpenAIClient.chat.completions.create({
            model,
            stream: true,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                ...messages,
            ],
            max_completion_tokens: 1000,
        });

        let fullResponse = "";

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                fullResponse += content;
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
        }

        // Signal completion
        res.write("data: [DONE]\n\n");
        res.end();

        console.log(`Assistant: ${fullResponse}\n`);
    } catch (err) {
        console.error("Chat error:", err.message);
        const errorMsg = err.status ? `API error ${err.status}: ${err.message}` : err.message;
        // If headers haven't been sent yet, send JSON error
        if (!res.headersSent) {
            res.status(500).json({ error: errorMsg });
        } else {
            res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
            res.write("data: [DONE]\n\n");
            res.end();
        }
    }
});

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

app.listen(PORT, () => {
    console.log(`\n🚀 PersonaAI server running at http://localhost:${PORT}\n`);
});
