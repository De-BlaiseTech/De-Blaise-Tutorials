export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. Fetch All WAEC/NECO Subjects
      if (pathname === "/api/subjects" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT * FROM subjects ORDER BY category, name ASC"
        ).all();

        return Response.json(
          { success: true, subjects: results },
          { headers: corsHeaders }
        );
      }

      // 2. Fetch Topics for Selected Subject
      if (pathname === "/api/topics" && request.method === "GET") {
        const subjectId = url.searchParams.get("subject_id");

        if (!subjectId) {
          return Response.json(
            { success: false, error: "Missing 'subject_id' parameter." },
            { status: 400, headers: corsHeaders }
          );
        }

        const { results } = await env.DB.prepare(
          "SELECT * FROM topics WHERE subject_id = ? ORDER BY title ASC"
        ).bind(subjectId).all();

        return Response.json(
          { success: true, topics: results },
          { headers: corsHeaders }
        );
      }

      // 3. Fetch Existing Tutorial Topic from D1
      if (pathname === "/api/get-tutorial" && request.method === "GET") {
        const subjectId = url.searchParams.get("subjectId");
        const topicId = url.searchParams.get("topicId");

        if (!subjectId || !topicId) {
          return Response.json(
            { success: false, error: "Missing 'subjectId' or 'topicId' parameter." },
            { status: 400, headers: corsHeaders }
          );
        }

        const { results } = await env.DB.prepare(
          "SELECT t.*, s.name as subject_name FROM tutorials t JOIN subjects s ON t.subject_id = s.id WHERE t.subject_id = ? AND t.id = ?"
        ).bind(subjectId, topicId).all();

        if (!results || results.length === 0) {
          return Response.json(
            { success: false, error: "Tutorial topic not found." },
            { status: 404, headers: corsHeaders }
          );
        }

        const tutorial = results[0];

        return Response.json(
          {
            success: true,
            data: {
              id: tutorial.id,
              subjectId: tutorial.subject_id,
              subjectName: tutorial.subject_name,
              title: tutorial.title,
              chalkboardScript: JSON.parse(tutorial.chalkboard_script),
              audioUrl: tutorial.audio_url || null,
              quizUrl: tutorial.quiz_url || "https://cbt.de-blaisetechnologies.com.ng"
            }
          },
          { headers: corsHeaders }
        );
      }

      // 4. Gemini API Lesson Generator (Comprehensive Textbook Notes)
      if (pathname === "/api/generate-ai-script" && request.method === "POST") {
        const { topic, subjectName } = await request.json();

        if (!topic || !subjectName) {
          return Response.json(
            { success: false, error: "Missing 'topic' or 'subjectName' in body." },
            { status: 400, headers: corsHeaders }
          );
        }

        const apiKey = env.GEMINI_API_KEY;

        if (!apiKey) {
          return Response.json(
            { success: false, error: "GEMINI_API_KEY is missing from Cloudflare environment variables." },
            { status: 500, headers: corsHeaders }
          );
        }

        const prompt = `You are a Senior Secondary School teacher writing a complete, detailed textbook lesson for WAEC and NECO students on "${topic}" under "${subjectName}".

Write comprehensive, exhaustive notes that students can directly copy into their exercise books. Do NOT summarize or use generic statements.

Include:
1. Complete, formal textbook definition of ${topic} with detailed explanation of key technical terms.
2. Complete list of all types, classifications, or forms with thorough descriptions for each.
3. Detailed features, advantages, disadvantages, or key rules.
4. A full practical worked example, step-by-step case study, or mathematical calculation.
5. Key WAEC/NECO examination tips and common mistakes to avoid.

Divide your output strictly into 4 steps using "===STEP===" as the separator.

Format each step like this:

SPOKEN: Welcome students! Today we are studying ${topic} in ${subjectName}.
BOARD:
SUBJECT: ${subjectName}
TOPIC: ${topic}
CLASS: SS1 - SS3 (WAEC/NECO Syllabus)

===STEP===

SPOKEN: Let's begin with the formal definition and fundamental concepts.
BOARD:
1. DEFINITION & OVERVIEW OF ${topic.toUpperCase()}:
[Write full, thorough textbook notes here]

===STEP===

SPOKEN: Now let's detail the types, classifications, and features.
BOARD:
2. TYPES & CLASSIFICATIONS:
[Write complete lists with detailed descriptions here]

===STEP===

SPOKEN: Let's work through an examination example step-by-step.
BOARD:
3. WORKED EXAMPLE & EXAM ANALYSIS:
[Write full step-by-step worked calculation or case study here]`;

        try {
          // Gemini API Call (Supports key as URL parameter)
          const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

          const geminiRes = await fetch(endpointUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 3000
              }
            })
          });

          const data = await geminiRes.json();

          // If Google returns an error response, report it directly!
          if (!geminiRes.ok || data.error) {
            console.error("Gemini API Error:", JSON.stringify(data));
            return Response.json(
              { 
                success: false, 
                error: `Google API Error (${geminiRes.status}): ${data.error ? data.error.message : "Authentication or request failed"}` 
              },
              { status: 500, headers: corsHeaders }
            );
          }

          const rawText = data.candidates[0].content.parts[0].text;
          let steps = [];

          if (rawText.includes("===STEP===")) {
            const stepBlocks = rawText.split("===STEP===");
            steps = stepBlocks.map(block => {
              const spokenMatch = block.match(/SPOKEN:\s*([\s\S]*?)(?=BOARD:|$)/i);
              const boardMatch = block.match(/BOARD:\s*([\s\S]*?)$/i);

              return {
                spokenText: spokenMatch ? spokenMatch[1].trim() : `Let's examine ${topic}.`,
                chalkboardAction: boardMatch ? boardMatch[1].trim() : block.trim()
              };
            }).filter(s => s.chalkboardAction.length > 5);
          } else {
            const chunks = rawText.split("\n\n");
            steps = [
              {
                spokenText: `Welcome to class! Today we are studying ${topic} in ${subjectName}.`,
                chalkboardAction: chunks.slice(0, 2).join("\n\n")
              },
              {
                spokenText: `Let's break down the details for ${topic}.`,
                chalkboardAction: chunks.slice(2).join("\n\n") || rawText
              }
            ];
          }

          return Response.json(
            { success: true, topic, subjectName, chalkboardScript: steps },
            { headers: corsHeaders }
          );

        } catch (err) {
          return Response.json(
            { success: false, error: `Worker Execution Error: ${err.message}` },
            { status: 500, headers: corsHeaders }
          );
        }
      }

      // 5. Save Student Progress
      if (pathname === "/api/save-progress" && request.method === "POST") {
        const { studentId, topicId, completed } = await request.json();

        if (!studentId || !topicId) {
          return Response.json(
            { success: false, error: "Missing 'studentId' or 'topicId'." },
            { status: 400, headers: corsHeaders }
          );
        }

        const recordId = `${studentId}_${topicId}`;

        await env.DB.prepare(`
          INSERT INTO student_progress (id, student_id, topic_id, completed, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            completed = excluded.completed,
            updated_at = CURRENT_TIMESTAMP
        `).bind(recordId, studentId, topicId, completed ? 1 : 0).run();

        return Response.json(
          { success: true, message: "Progress updated successfully." },
          { headers: corsHeaders }
        );
      }

      // Fallback: Static Assets
      return await env.ASSETS.fetch(request);

    } catch (error) {
      return Response.json(
        { success: false, error: "Internal Server Error", details: error.message },
        { status: 500, headers: corsHeaders }
      );
    }
  }
};
