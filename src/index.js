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

      // 4. Gemini 1.5 Flash API Script Generator (Textbook Notes Mode)
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
            { success: false, error: "GEMINI_API_KEY binding is missing in Cloudflare Worker settings." },
            { status: 500, headers: corsHeaders }
          );
        }

        const prompt = `You are a master Senior Secondary School teacher for de-blaise-tutorials preparing students for WAEC and NECO exams.
Write a comprehensive, textbook-grade lesson on the topic "${topic}" under the subject "${subjectName}".

Write complete, thorough educational content that students can copy directly into their notebooks. Include actual definitions, real classifications/types, detailed worked numerical examples/case studies, formulas, and WAEC exam tips.

The lesson MUST be divided into EXACTLY 4 teaching steps separated by the tag "===STEP===".

Follow this structure EXACTLY:

SPOKEN: Welcome students! Today we are studying ${topic} under ${subjectName}. Let's write down the lesson header.
BOARD:
SUBJECT: ${subjectName}
TOPIC: ${topic}
CLASS: SS1 - SS3 (WAEC/NECO Standard)
===STEP===
SPOKEN: First, let's establish the complete formal definition and foundational rules of ${topic}.
BOARD:
1. FORMAL DEFINITION & FOUNDATIONAL PRINCIPLES:
[Write the exact, full textbook definition with key technical terms explained in detail]
===STEP===
SPOKEN: Now, let's examine the main classifications, types, or key components you must memorize for your exam.
BOARD:
2. TYPES & CLASSIFICATIONS:
- [Type 1 Name]: Detailed description and characteristics
- [Type 2 Name]: Detailed description and characteristics
- [Type 3 Name]: Detailed description and characteristics
===STEP===
SPOKEN: Let's solve a real, worked examination example step-by-step so you see how WAEC examiners grade this topic.
BOARD:
3. WORKED EXAMPLE & STEP-BY-STEP SOLUTION:
[Provide actual equations, numbers, steps, or realistic scenario analysis]
===STEP===
SPOKEN: To wrap up today's lesson, here is a quick summary and common student pitfalls to avoid in WAEC/NECO examinations.
BOARD:
4. WAEC/NECO EXAMINATION SUMMARY:
- Key formulas or rules to remember
- Common student mistakes in exams
- Practice past questions on CBT Practice Engine`;

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
                  maxOutputTokens: 3000
                }
              })
            }
          );

          const data = await geminiRes.json();

          if (!data.candidates || !data.candidates[0].content.parts[0].text) {
            throw new Error("Invalid response structure from Gemini API");
          }

          const rawResponse = data.candidates[0].content.parts[0].text;

          // Robust delimiter parsing that never breaks on long JSON text
          const stepBlocks = rawResponse.split("===STEP===");
          const steps = stepBlocks.map(block => {
            const spokenMatch = block.match(/SPOKEN:\s*([\s\S]*?)(?=BOARD:|$)/i);
            const boardMatch = block.match(/BOARD:\s*([\s\S]*?)$/i);

            return {
              spokenText: spokenMatch ? spokenMatch[1].trim() : `Let's examine ${topic}.`,
              chalkboardAction: boardMatch ? boardMatch[1].trim() : `${topic} Notes`
            };
          });

          return Response.json(
            { success: true, topic, subjectName, chalkboardScript: steps },
            { headers: corsHeaders }
          );

        } catch (err) {
          console.error("Gemini API Error:", err);
          return Response.json(
            { success: false, error: "Failed to generate lesson content.", details: err.message },
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
