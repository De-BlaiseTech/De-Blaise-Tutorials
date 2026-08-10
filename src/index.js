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

      // 4. Gemini API Script Generator (Robust Textbook Mode)
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
            { success: false, error: "GEMINI_API_KEY environment variable is missing." },
            { status: 500, headers: corsHeaders }
          );
        }

        const prompt = `You are a Senior Secondary School teacher for de-blaise-tutorials preparing students for WAEC and NECO exams.
Write a comprehensive, textbook-grade lesson note on the topic "${topic}" under "${subjectName}".

Requirements:
- Write actual detailed definitions, real types/classifications, complete worked examples/case studies, and exam tips.
- Provide full content so students can copy complete notes into their notebooks.

Divide your teaching strictly into 4 steps using the tag "===STEP===" between each step.

Format each step like this:

SPOKEN: [Teacher spoken explanation]
BOARD:
[Full detailed textbook notes for chalkboard]

===STEP===

SPOKEN: [Teacher spoken explanation for definitions]
BOARD:
1. DEFINITION & OVERVIEW
[Write complete, detailed textbook definition and foundational rules]

===STEP===

SPOKEN: [Teacher spoken explanation for classifications/types]
BOARD:
2. TYPES & CLASSIFICATIONS
- [Type 1]: Full description and details
- [Type 2]: Full description and details

===STEP===

SPOKEN: [Teacher spoken explanation for practical/worked example]
BOARD:
3. WORKED EXAMPLE / PRACTICAL APPLICATION
[Full step-by-step example with numbers, equations, or analysis]`;

        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.2,
                  maxOutputTokens: 2500
                }
              })
            }
          );

          const data = await geminiRes.json();

          if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error("Gemini API Error Response:", JSON.stringify(data));
            throw new Error(data.error ? data.error.message : "Invalid Gemini API Response");
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
            // Fallback split by double line breaks if model omitted ===STEP===
            const chunks = rawText.split("\n\n");
            steps = [
              {
                spokenText: `Welcome to class! Today we are studying ${topic} in ${subjectName}.`,
                chalkboardAction: `SUBJECT: ${subjectName}\nTOPIC: ${topic}\n\n${chunks.slice(0, 2).join("\n\n")}`
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
          console.error("Gemini Execution Error:", err);
          return Response.json(
            { success: false, error: err.message },
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
