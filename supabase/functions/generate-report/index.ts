import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  userId: string;
  reportId: string;
  prompt: string;
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
    const n8nWebhookUrl = Deno.env.get('VITE_N8N_WEBHOOK_URL');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    if (!n8nWebhookUrl) {
      throw new Error('VITE_N8N_WEBHOOK_URL environment variable is not set. Please configure it in your Supabase project settings.');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, reportId, prompt }: RequestBody = await req.json();

    console.log('📊 Generating report for user:', userId, 'reportId:', reportId);

    // Fetch user details
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !userData?.user?.email) {
      throw new Error('User not found or email unavailable');
    }

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

    // Use the prompt from the database to ensure we have the latest version
    const latestPrompt = report.prompt;
    console.log('📊 Using prompt from database:', latestPrompt.substring(0, 100) + '...');

    // Call n8n webhook to generate report with accurate data
    console.log('🌐 Calling n8n webhook for report generation...');
    const webhookResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatInput: latestPrompt,
        user_id: userId,
        user_email: userData.user.email,
        user_name: userData.user.user_metadata?.full_name || userData.user.email,
        conversation_id: null,
        mode: 'reports',
        original_message: latestPrompt,
        mentions: []
      })
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error('❌ n8n webhook failed:', webhookResponse.status, errorText);
      throw new Error('Failed to get report from n8n webhook');
    }

    const responseText = await webhookResponse.text();
    let reportText = responseText;

    // Try to parse JSON response
    try {
      const jsonResponse = JSON.parse(responseText);
      if (jsonResponse.output) {
        reportText = jsonResponse.output;
      }
    } catch (e) {
      // Use raw text if not JSON
    }

    console.log('✅ Report generated successfully from n8n webhook');

    // Save report message to astra_chats
    const { error: insertError } = await supabase
      .from('astra_chats')
      .insert({
        user_id: userId,
        user_email: userData.user.email,
        mode: 'reports',
        message: reportText,
        message_type: 'astra',
        metadata: {
          report_title: report.title,
          report_schedule: report.schedule_time,
          report_frequency: report.schedule_frequency,
          is_manual_run: true,
          executed_at: new Date().toISOString()
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