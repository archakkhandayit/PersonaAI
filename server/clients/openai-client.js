import "dotenv/config";

export const apiKeyChecker = () => {
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
        console.error(
            "Error: API_KEY is not set in the invironment variables."
        )
    }
}

export const checkOpenAI = async () => {
    const OpenAI = (await import("openai")).default

    const client = new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: process.env.GROQ_BASE_URL,
    });

    if (!client) {
        console.error("Error: Failed to initialize OpenAi client.")
        process.exit(1);
    }

    console.log("OpenAi client initialized successfully\n");
    return client;

}