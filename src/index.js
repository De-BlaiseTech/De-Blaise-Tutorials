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
          const systemPrompt = "You are a master West African secondary school teacher preparing students for WAEC/NECO exams. Output ONLY a valid raw JSON object. Do not wrap in markdown or backticks.";
          const userPrompt = `Create a detailed, comprehensive 5-step lesson for the topic "${topic}" in "${subjectName}" aligned with the WAEC/NECO SS1-SS3 syllabus.

The lesson MUST cover:
1. Introduction & Formal Definition
2. Types, Classifications, or Key Components
3. Step-by-Step Worked Example or Detailed Explanation
4. Common Exam Pitfalls & Key Formulas/Rules
5. Quick Summary & WAEC Exam Tip

Return EXACTLY a JSON object with this key structure:
{
  "steps": [
    {
      "spokenText": "Detailed explanation written in clear, engaging simple teacher tone explaining definitions, concepts, and steps...",
      "chalkboardAction": "Clear chalkboard notes, formulas, bullet points, or worked mathematical steps..."
    }
  ]
}`;

          // Call Cloudflare Workers AI (LLaMA 3 Chat Model)
          const aiResponse = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            max_tokens: 2500
          });

          // Extract text response safely
          const rawText = aiResponse.response || (typeof aiResponse === "string" ? aiResponse : JSON.stringify(aiResponse));
          
          // Clean markdown formatting like ```json or ```
          const cleanText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          
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

        // Detailed 5-Step Fallback Generator if AI parsing fails
        if (!steps || steps.length === 0) {
          steps = [
            {
              spokenText: `Welcome to class! Today we are diving deep into ${topic} under ${subjectName}. This is a crucial topic for your WAEC and NECO examinations.`,
              chalkboardAction: `SUBJECT: ${subjectName}\nTOPIC: ${topic}\nLEVEL: SS1 - SS3 Senior Secondary`
            },
            {
              spokenText: `Let's start with the fundamental definition. ${topic} involves core rules and principles that form the foundation for standard examination questions.`,
              chalkboardAction: `1. DEFINITION & CORE PRINCIPLES:\n- Key concept of ${topic}\n- Fundamental Laws & Standards`
            },
            {
              spokenText: `Now let's break down the types and classifications you must know for your theoretical and objective exams.`,
              chalkboardAction: `2. CLASSIFICATION & TYPES:\n- Primary Features & Variations\n- Key Components`
            },
            {
              spokenText: `Pay close attention to this worked example. In exams, markers look for clear step-by-step logic and correct application of formulas or concepts.`,
              chalkboardAction: `3. WORKED EXAMPLE / APPLICATION:\nStep 1: Identify given terms\nStep 2: Apply core rule\nStep 3: State final conclusion`
            },
            {
              spokenText: `To round up, remember that WAEC often tests common student mistakes in this topic. Always double check your units and definitions!`,
              chalkboardAction: `4. WAEC/NECO EXAM SUMMARY:\n- Review formulas & definitions\n- Avoid common calculation errors\n- Practice past questions on CBT Engine`
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
