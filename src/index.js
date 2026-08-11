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

      // 4. Native Cloudflare Workers AI Script Generator (Textbook Mode)
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
          const systemPrompt = `You are a Senior Secondary School Textbook Author and WAEC/NECO Chief Examiner. 
Your goal is to teach "${topic}" under "${subjectName}" thoroughly and comprehensively. 
Provide real definitions, exact classifications, actual lists, fully worked numerical examples, and realistic WAEC past exam points.
Do NOT use placeholder summaries or placeholders like "Type A" or "Rule 1". Write full, actual educational content.`;

          const userPrompt = `Teach the topic "${topic}" for ${subjectName} in EXACTLY 4 comprehensive steps.

Format your entire response strictly as valid JSON with NO extra text before or after:
{
  "steps": [
    {
      "spokenText": "Welcome students! Today we are learning about ${topic} in ${subjectName}...",
      "chalkboardAction": "TOPIC: ${topic}\\nSUBJECT: ${subjectName}"
    },
    {
      "spokenText": "Detailed explanation defining ${topic} comprehensively...",
      "chalkboardAction": "1. DEFINITION:\\n[Write the exact, full textbook definition here]"
    },
    {
      "spokenText": "Explanation detailing all the real types, components, or key characteristics of ${topic}...",
      "chalkboardAction": "2. TYPES & FEATURES:\\n- [Type 1 with description]\\n- [Type 2 with description]\\n- [Type 3 with description]"
    },
    {
      "spokenText": "Walkthrough of a real, fully worked numerical calculation or practical examination scenario...",
      "chalkboardAction": "3. WORKED EXAMPLE / CASE STUDY:\\n[Write actual equations, numbers, steps, or detailed textual breakdown here]"
    }
  ]
}`;

          // Call Cloudflare Workers AI
          const aiResponse = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            max_tokens: 2200,
            temperature: 0.3 // Lower temperature prevents creative formatting hallucinations
          });

          const rawText = aiResponse.response || (typeof aiResponse === "string" ? aiResponse : JSON.stringify(aiResponse));
          
          // Clean out markdown code fence block if present
          let cleanText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          
          const jsonStart = cleanText.indexOf('{');
          const jsonEnd = cleanText.lastIndexOf('}') + 1;

          if (jsonStart !== -1 && jsonEnd > jsonStart) {
            cleanText = cleanText.substring(jsonStart, jsonEnd);
            const parsed = JSON.parse(cleanText);
            if (parsed.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
              steps = parsed.steps;
            }
          }
        } catch (e) {
          console.error("AI Parsing Exception:", e);
        }

        // Emergency Fallback (In case Cloudflare AI service times out)
        if (!steps || steps.length === 0) {
          steps = [
            {
              spokenText: `Welcome students! Today we are examining ${topic} under ${subjectName} according to the WAEC and NECO syllabus.`,
              chalkboardAction: `SUBJECT: ${subjectName}\nTOPIC: ${topic}\nLEVEL: SS1 - SS3`
            },
            {
              spokenText: `${topic} is defined as the systematic study and application of core principles governing ${subjectName}. It plays a crucial role in senior secondary education.`,
              chalkboardAction: `1. DEFINITION:\n${topic} refers to the practical and theoretical processes involved in ${subjectName}.`
            },
            {
              spokenText: `Key branches of ${topic} include foundational theory, structural analysis, and practical implementation.`,
              chalkboardAction: `2. CORE BRANCHES & TYPES:\n- Theoretical Foundations\n- Practical Applications\n- Analytical Evaluation`
            },
            {
              spokenText: `Always remember to review past WAEC/NECO questions on ${topic} using your CBT practice engine.`,
              chalkboardAction: `3. EXAMINATION STRATEGY:\n- Master key definitions\n- Practice step-by-step solutions\n- Test your speed on CBT engine`
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
