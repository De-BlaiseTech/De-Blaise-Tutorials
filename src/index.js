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

      // 4. Gemini 2.5 Flash API Generator (Comprehensive Lesson Generator)
      if (pathname === "/api/generate-ai-script" && request.method === "POST") {
        const { topic, subjectName } = await request.json();

        if (!topic || !subjectName) {
          return Response.json(
            { success: false, error: "Missing 'topic' or 'subjectName' in body." },
            { status: 400, headers: corsHeaders }
          );
        }

        const apiKey = env.GEMINI_API_KEY;

        let steps = [];

        // Try Gemini 2.5 Flash API Call if API key exists
        if (apiKey) {
          try {
            const prompt = `You are a Senior Secondary School teacher for de-blaise-tutorials preparing students for WAEC and NECO exams.
Write a comprehensive, textbook-grade lesson note on the topic "${topic}" under "${subjectName}".

Write complete, thorough educational content that students can copy directly into their notebooks. Include actual definitions, real classifications/types, detailed worked numerical examples/case studies, formulas, and WAEC exam tips.

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

            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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

            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
              const rawText = data.candidates[0].content.parts[0].text;

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
              }
            }
          } catch (e) {
            console.error("Gemini API execution error:", e);
          }
        }

        // Automatic Fallback System (Ensures 100% Uptime even without API key)
        if (!steps || steps.length === 0) {
          steps = [
            {
              spokenText: `Welcome students! Today we are examining ${topic} under ${subjectName} aligned with the WAEC and NECO syllabus.`,
              chalkboardAction: `SUBJECT: ${subjectName}\nTOPIC: ${topic}\nLEVEL: SS1 - SS3 Senior Secondary`
            },
            {
              spokenText: `Let's start with the formal definition. ${topic} involves the fundamental concepts, rules, and structures that govern ${subjectName}.`,
              chalkboardAction: `1. FORMAL DEFINITION OF ${topic.toUpperCase()}:\n- Systematic processes and theoretical frameworks in ${subjectName}.\n- Key Objectives: Comprehensive understanding for national examinations.`
            },
            {
              spokenText: `Now let's break down the primary classifications and types you must memorize for objective and theory questions.`,
              chalkboardAction: `2. TYPES & CLASSIFICATIONS:\n- Primary Branch: Core concepts and initial principles.\n- Secondary Branch: Practical applications and analytical evaluations.`
            },
            {
              spokenText: `Pay close attention to how WAEC examiners grade this topic in past questions. Master these key points before taking your CBT test.`,
              chalkboardAction: `3. WAEC/NECO EXAM STRATEGY:\n- Memorize core definitions and technical terms.\n- Practice calculations and step-by-step logic.\n- Practice past questions on CBT Practice Engine.`
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
