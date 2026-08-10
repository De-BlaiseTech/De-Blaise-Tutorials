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

      // 2. Fetch Existing Tutorial Topic from D1
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
              quizUrl: tutorial.quiz_url || "https://your-quiz-website.com"
            }
          },
          { headers: corsHeaders }
        );
      }

      // 3. Native Cloudflare Workers AI Script Generator
      if (pathname === "/api/generate-ai-script" && request.method === "POST") {
        const { topic, subjectName } = await request.json();

        if (!topic || !subjectName) {
          return Response.json(
            { success: false, error: "Missing 'topic' or 'subjectName' in body." },
            { status: 400, headers: corsHeaders }
          );
        }

        // System prompt tailored specifically for WAEC/NECO standard lessons
        const prompt = `You are an expert secondary school teacher for de-blaise-tutorials preparing students for WAEC and NECO national exams.
Explain the topic "${topic}" under the subject "${subjectName}" step-by-step for SS1-SS3 students.

Respond ONLY with valid JSON in this exact structure:
{
  "steps": [
    {
      "spokenText": "Teacher explanation here...",
      "chalkboardAction": "Text or equation to write on chalkboard..."
    }
  ]
}`;

        // Call Cloudflare Workers AI (LLaMA 3 Model)
        const aiResponse = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
          prompt: prompt,
          max_tokens: 1000
        });

        let scriptData;
        try {
          // Extract JSON string from AI response
          const jsonStart = aiResponse.response.indexOf('{');
          const jsonEnd = aiResponse.response.lastIndexOf('}') + 1;
          const cleanJson = aiResponse.response.substring(jsonStart, jsonEnd);
          scriptData = JSON.parse(cleanJson);
        } catch (e) {
          scriptData = {
            steps: [
              {
                spokenText: `Welcome to de-blaise-tutorials! Let's explore ${topic} in ${subjectName}.`,
                chalkboardAction: `${subjectName}: ${topic}`
              }
            ]
          };
        }

        return Response.json(
          {
            success: true,
            topic,
            subjectName,
            chalkboardScript: scriptData.steps
          },
          { headers: corsHeaders }
        );
      }

      // 4. Save Student Progress
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
