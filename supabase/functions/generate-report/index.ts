import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.24.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  userId: string;
  reportId: string;
  prompt: string;
  visualizationMode?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const geminiApiKey = Deno.env.get('VITE_GEMINI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    if (!geminiApiKey) {
      throw new Error('VITE_GEMINI_API_KEY environment variable is not set. Please configure it in your Supabase project settings.');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, reportId, prompt, visualizationMode }: RequestBody = await req.json();

    console.log('📊 Generating report for user:', userId, 'reportId:', reportId);

    // Fetch report configuration
    const { data: report, error: reportError } = await supabase
      .from('astra_reports')
      .select('*')
      .eq('id', reportId)
      .eq('user_id', userId)
      .single();

    if (reportError || !report) {
      throw new Error('Report not found or access denied');
    }

    // Generate AI response using Gemini
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 1.0,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const reportText = response.text();

    console.log('✅ Report generated successfully');

    // Save report message to astra_chats
    const { error: insertError } = await supabase
      .from('astra_chats')
      .insert({
        user_id: userId,
        mode: 'reports',
        message: reportText,
        message_type: 'astra',
        metadata: {
          report_title: report.title,
          report_schedule: report.schedule_time,
          report_frequency: report.schedule_frequency,
          is_manual_run: true,
          executed_at: new Date().toISOString(),
          visualization_mode: visualizationMode || report.visualization_mode || 'text'
        }
      });

    if (insertError) {
      console.error('Error inserting report message:', insertError);
      throw new Error(`Failed to save report: ${insertError.message}`);
    }

    // Update last_run_at timestamp
    await supabase
      .from('astra_reports')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', reportId);

    console.log('✅ Report saved to database');

    return new Response(
      JSON.stringify({ success: true, message: 'Report generated successfully' }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('❌ Error generating report:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'An unexpected error occurred'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});