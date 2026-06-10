import { createClient } from '@supabase/supabase-js';
import * as admin from 'firebase-admin';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
  } catch (err) {
    console.error('Firebase Admin init error:', (err as Error).message);
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { account_id, amount, description } = req.body;

    if (!account_id || !amount || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('partner_id')
      .eq('id', account_id)
      .single();

    if (!userProfile?.partner_id) {
      return res.status(200).json({ success: true, message: 'No partner linked' });
    }

    const { data: partnerProfile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', userProfile.partner_id)
      .single();

    const partnerToken = partnerProfile?.push_token;

    if (partnerToken && admin.apps.length > 0) {
      await admin.messaging().send({
        token: partnerToken,
        notification: {
          title: 'Novo Gasto Compartilhado!',
          body: `Seu parceiro gastou R$${Number(amount).toFixed(2)} com ${description}`,
        },
        data: { amount: amount.toString(), description },
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error processing notify:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
