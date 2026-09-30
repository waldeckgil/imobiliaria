import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  // Responde imediatamente a requisições de preflight/CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      } 
    })
  }

  try {
    const url = new URL(req.url)
    
    // O Mercado Pago pode enviar o ID via query param (?data.id=123 ou ?id=123)
    let paymentId = url.searchParams.get("data.id") || url.searchParams.get("id")

    // Ou pode enviar via corpo da requisição (JSON body)
    if (!paymentId && req.method === 'POST') {
      try {
        const body = await req.json()
        paymentId = body?.data?.id || body?.id
      } catch (e) {
        // Corpo vazio ou não JSON
      }
    }

    // Se for um evento que não é de pagamento (ex: teste do MP), responde 200 para liberar a fila
    if (!paymentId) {
      return new Response(JSON.stringify({ status: "ignorado_sem_id_pagamento" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    }

    // Conecta ao Supabase com privilégios de Service Role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Dispara a procedure SQL que criamos no Passo 1!
    const { data, error } = await supabaseClient.rpc('webhook_receber_pix_mp', {
      p_payment_id: String(paymentId)
    })

    if (error) {
      console.error("[WEBHOOK PIX ERRO SQL]", error)
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      })
    }

    console.log("[WEBHOOK PIX SUCESSO]", data)
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })

  } catch (err: any) {
    console.error("[WEBHOOK PIX EXCECAO]", err)
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 200, // Retorna 200 para evitar que o Mercado Pago fique travando a fila
      headers: { "Content-Type": "application/json" }
    })
  }
})