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

      // 4. Native Cloudflare Workers AI Script Generator
      if (pathname === "/api/generate-ai-script" && request.method === "POST") {
        const { topic, subjectName } = await request.json();

        if (!topic || !subjectName) {
          return Response.json(
            { success: false, error: "Missing 'topic' or 'subjectName' in body." },
            { status: 400, headers: corsHeaders }
          );
        }

        let steps = [];

        try {
          // Call Cloudflare Workers AI (LLaMA 3 Chat Model)
          const aiResponse = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
            messages: [
              {
                role: "system",
                content: "You are an expert WAEC/NECO teacher. Output ONLY raw JSON. Do not include markdown formatting, backticks, or intro text."
              },
              {
                role: "user",
                content: `Create a 3-step chalkboard lesson for the topic "${topic}" in "${subjectName}".
Return EXACTLY a JSON object with a "steps" array containing objects with "spokenText" and "chalkboardAction".
Example format:
{
  "steps": [
    {"spokenText": "Welcome to class...", "chalkboardAction": "Topic: ${topic}"}
  ]
}`
              }
            ],
            max_tokens: 1000
          });

          // Extract text response safely
          const rawText = aiResponse.response || (typeof aiResponse === "string" ? aiResponse : JSON.stringify(aiResponse));
          
          // Clean out markdown code blocks if LLaMA added them
          const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          
          const jsonStart = cleanText.indexOf('{');
          const jsonEnd = cleanText.lastIndexOf('}') + 1;

          if (jsonStart !== -1 && jsonEnd > jsonStart) {
            const parsed = JSON.parse(cleanText.substring(jsonStart, jsonEnd));
            if (parsed.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
              steps = parsed.steps;
            }
          }
        } catch (e) {
          console.error("AI Parsing Error:", e);
        }

        // Guaranteed fallback if AI output fails or parses empty
        if (!steps || steps.length === 0) {
          steps = [
            {
              spokenText: `Welcome to de-blaise-tutorials! Today we are studying ${topic} under ${subjectName}.`,
              chalkboardAction: `Subject: ${subjectName}\nTopic: ${topic}`
            },
            {
              spokenText: `In WAEC and NECO examinations, questions on ${topic} focus on core principles and definitions.`,
              chalkboardAction: `Key Focus: ${topic} Principles`
            },
            {
              spokenText: `Review these concepts carefully and proceed to practice past exam questions in the CBT engine.`,
              chalkboardAction: `Summary: ${topic} Complete`
            }
          ];
        }

        return Response.json(
          {
            success: true,
            topic,
            subjectName,
            chalkboardScript: steps
          },
          { headers: corsHeaders }
        );
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
