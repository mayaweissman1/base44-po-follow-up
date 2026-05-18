import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { po_number } = body;

    if (!po_number) {
      return Response.json({ error: 'po_number is required' }, { status: 400 });
    }

    const updates = await base44.entities.dd_updates.filter(
      { po_number },
      '-created_date',
      200
    );

    return Response.json({ updates });
  } catch (error) {
    console.error('getPoActivityLog error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});