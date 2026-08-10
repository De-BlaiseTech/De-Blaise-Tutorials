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

      // 4. Groq Cloud AI Lesson Note Generator
      if (pathname === "/api/generate-ai-script" && request.method === "POST") {
        const { topic, subjectName } = await request.json();

        if (!topic || !subjectName) {
          return Response.json(
            { success: false, error: "Missing 'topic' or 'subjectName' in request body." },
            { status: 400, headers: corsHeaders }
          );
        }

        const apiKey = env.GROQ_API_KEY;

        if (!apiKey) {
          return Response.json(
            { success: false, error: "GROQ_API_KEY variable is missing in Cloudflare Worker settings." },
            { status: 500, headers: corsHeaders }
          );
        }

        const prompt = `You are a master Senior Secondary School teacher for de-blaise-tutorials preparing students for WAEC and NECO national examinations.
Write a comprehensive, textbook-grade lesson note on "${topic}" under "${subjectName}".

Requirements:
- Write out actual, detailed educational content so students can copy complete, exhaustive notes directly into their notebooks.
- Include complete formal definitions, real classifications/types with thorough descriptions, detailed features, fully worked numerical examples or step-by-step case studies, and key WAEC/NECO exam tips.
- Do NOT use placeholders, generic text, or summaries.

Divide your teaching strictly into 4 steps using the exact tag "===STEP===" as the separator between steps.

Format each step strictly like this:

SPOKEN: Welcome students! Today we are studying ${topic} under ${subjectName}.
BOARD:
SUBJECT: ${subjectName}
TOPIC: ${topic}
CLASS: SS1 - SS3 (WAEC/NECO Syllabus)

===STEP===

SPOKEN: Let's begin with the formal textbook definition and foundational concepts.
BOARD:
1. FORMAL DEFINITION & OVERVIEW OF ${topic.toUpperCase()}:
[Write full, thorough textbook notes here with technical terms explained in detail]

===STEP===

SPOKEN: Now let's detail the main types, classifications, and key characteristics.
BOARD:
2. TYPES, CLASSIFICATIONS & FEATURES:
- [Type 1 Name]: Detailed explanation and characteristics
- [Type 2 Name]: Detailed explanation and characteristics
- [Type 3 Name]: Detailed explanation and characteristics

===STEP===

SPOKEN: Let's work through a practical examination example or calculation step-by-step.
BOARD:
3. WORKED EXAMPLE / PRACTICAL ANALYSIS:
[Write a complete step-by-step worked calculation, formula application, or realistic case study]`;

        try {
          const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [{ role: "user", content: prompt }],
              temperature: 0.2,
              max_tokens: 3000
            })
          });

          const data = await groqRes.json();

          if (!groqRes.ok || data.error) {
            console.error("Groq API Error:", JSON.stringify(data));
            return Response.json(
              { 
                success: false, 
                error: `Groq API Error (${groqRes.status}): ${data.error ? data.error.message : "Request failed"}` 
              },
              { status: 500, headers: corsHeaders }
            );
          }

          const rawText = data.choices[0].message.content;
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
            { success: false, error: `Execution Error: ${err.message}` },
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
