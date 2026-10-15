/**
 * POST /api/ai/generate
 * Guarded Administrative Autopilot using Google Gemini
 * Requires Admin/Staff authentication
 */
import { validateRequest } from '../../_lib/auth.js';
import { getCorsHeaders } from '../../_lib/cors.js';

const SYSTEM_INSTRUCTION = `Tu es l'Autopilot Administratif Intelligent de l'institut INFOHAS (Établissement privé de formation professionnelle supérieure au Maroc, accrédité sous N° 25/K0183/DFPP/45).
Ta mission est d'assister la direction pédagogique et les administrateurs scolaires dans :
1. La détection proactive des anomalies d'assiduité et des abandons potentiels.
2. La synthèse rigoureuse des rapports de présence par promotion et par classe (ex: LONDON 2027, OTTAWA 2027, BARCELONA 2027).
3. La rédaction de correspondances institutionnelles impeccables à l'attention des tuteurs et parents (WhatsApp, convocation, avertissement d'absence, notification de conseil de discipline).

Règles impératives :
- Ton style est professionnel, courtois, précis, juridique et conforme au règlement des instituts professionnels marocains.
- Respecte les seuils disciplinaires de l'INFOHAS : 3 absences = Avertissement 1; 5 absences = Avertissement 2; 8 absences = Convocation au Conseil de Discipline et blocage des examens.
- Rédige en français soigné par défaut, ou en arabe si expressément demandé.
- Ne modifie JAMAIS directement la base de données : formule tes propositions pour approbation humaine systématique par l'administration.`;

export async function onRequestPost(context) {
  const cors = getCorsHeaders(context.request);
  const db = context.env.DB;

  const auth = await validateRequest(context.request, db);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({ success: false, error: auth.error }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  try {
    let body = {};
    try {
      body = await context.request.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Corps JSON invalide' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const { task = 'custom', prompt, contextData, model } = body;

    // Resolve API Key
    let apiKey = context.env.GEMINI_API_KEY;
    let selectedModel = model || 'gemini-2.5-flash';

    if (!apiKey && db) {
      try {
        const row = await db.prepare(
          "SELECT data FROM school_settings WHERE key = 'ai_config' LIMIT 1"
        ).first();
        if (row && row.data) {
          const cfg = JSON.parse(row.data);
          if (cfg.apiKey) apiKey = cfg.apiKey;
          if (!model && cfg.defaultModel) selectedModel = cfg.defaultModel;
        }
      } catch (e) {
        console.warn('[ai/generate] D1 config lookup failed:', e.message);
      }
    }

    if (!apiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Clé API Gemini non configurée. Veuillez ajouter votre clé dans les Paramètres IA.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // Build task-specific prompt
    let userPrompt = prompt || '';
    if (task === 'attendance_anomaly') {
      userPrompt = `Analyse les données d'assiduité récentes suivantes et dresse la liste des étudiants en situation critique ou à risque élevé d'abandon :\n\nDonnées fournies :\n${JSON.stringify(contextData || {}, null, 2)}\n\nInstructions :\n1. Identifie les élèves ayant dépassé 3, 5 ou 8 absences.\n2. Signale les absences non justifiées consécutives.\n3. Propose des actions concrètes prioritaires pour chaque cas critique.`;
    } else if (task === 'absence_summary') {
      userPrompt = `Produis une synthèse analytique de la fréquentation scolaire pour la direction pédagogique :\n\nDonnées fournies :\n${JSON.stringify(contextData || {}, null, 2)}\n\nInstructions :\n1. Calcule ou commente les taux de présence globaux et par classe.\n2. Dégage les tendances notables (jours de pointe, modules touchés).\n3. Recommande des mesures d'amélioration pour la semaine à venir.`;
    } else if (task === 'parent_notice') {
      userPrompt = `Rédige un message institutionnel adapté aux tuteurs légaux :\n\nDétails :\n${JSON.stringify(contextData || {}, null, 2)}\n\nInstructions supplémentaires : ${prompt || 'Rédige une version prête à envoyer par WhatsApp et une version formelle pour courrier officiel'}.`;
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

    const payload = {
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 2048,
      },
    };

    const startTime = Date.now();
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const durationMs = Date.now() - startTime;

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({
        success: false,
        status: res.status,
        error: `Erreur API Gemini (${res.status}): ${errText}`,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const data = await res.json();
    const candidate = data?.candidates?.[0];
    const generatedText = candidate?.content?.parts?.map(p => p.text).join('\n') || '';

    return new Response(JSON.stringify({
      success: true,
      model: selectedModel,
      task,
      result: generatedText,
      durationMs,
      usage: data?.usageMetadata || {},
    }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch (err) {
    console.error('[ai/generate] Error:', err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Erreur lors de la génération IA',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
}
