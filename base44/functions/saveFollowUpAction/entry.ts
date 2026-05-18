import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const REASON_TO_RESPONSIBILITY = {
  'Force Majeure': 'OTHER',
  'DD Temporary': 'OTHER',
  'PPS Approval Late': 'EDIKTED',
  'Fabric Approval Late': 'EDIKTED',
  'QC Approval Late': 'EDIKTED',
  'Wrong Packing Materials': 'EDIKTED',
  'Labels Arrive Late': 'EDIKTED',
  'QC Reproduction': 'SUPPLIER',
  'QC ReWork': 'SUPPLIER',
  'PPS Submission Late': 'SUPPLIER',
  'Fabric Issue': 'SUPPLIER',
  'Production Capacity Issue': 'SUPPLIER',
  'Technical problem - washing': 'SUPPLIER',
  'Technical problem - printing': 'SUPPLIER',
  'Technical problem - sewing / handmade': 'SUPPLIER',
  'Packing Issue': 'SUPPLIER',
  'Special details late': 'SUPPLIER',
};

// Auto-approve if delay is 3 days or less and reason is not SUPPLIER
function shouldAutoApprove(originalDueDate, newDueDate, reason) {
  if (!originalDueDate || !newDueDate) return false;
  const diffDays = Math.round((new Date(newDueDate) - new Date(originalDueDate)) / 86400000);
  const responsibility = REASON_TO_RESPONSIBILITY[reason] || 'OTHER';
  return diffDays <= 3 && responsibility !== 'SUPPLIER';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action_type, po_number, payload } = body;

    if (!action_type || !po_number) {
      return Response.json({ error: 'action_type and po_number are required' }, { status: 400 });
    }

    // ── DDD_UPDATE ─────────────────────────────────────────────
    if (action_type === 'DDD_UPDATE') {
      const { new_due_date, reason, ddd_comment, previous_due_date, original_due_date, is_urgent } = payload;

      if (!new_due_date || !reason || !ddd_comment) {
        return Response.json({ error: 'new_due_date, reason, and ddd_comment are required' }, { status: 400 });
      }

      const responsibility = REASON_TO_RESPONSIBILITY[reason] || 'OTHER';
      const originalDate = original_due_date || previous_due_date;
      const cumulativeDelay = originalDate
        ? Math.round((new Date(new_due_date) - new Date(originalDate)) / 86400000)
        : 0;

      const autoApprove = shouldAutoApprove(originalDate, new_due_date, reason);
      const status = autoApprove ? 'AUTOMATICALLY' : (is_urgent ? 'HOLD' : 'HOLD');
      const now = new Date().toISOString();

      // Create the dd_update record
      const update = await base44.entities.dd_updates.create({
        po_number,
        actor_email: user.email,
        type: 'DDD_UPDATE',
        previous_due_date,
        new_due_date,
        reason,
        responsibility,
        ddd_comment,
        status,
        cumulative_delay_days: cumulativeDelay,
        decision_at: autoApprove ? now : null,
        decision_by_email: autoApprove ? 'system' : null,
      });

      // Upsert po_overrides
      const existing = await base44.entities.po_overrides.filter({ po_number });
      if (existing.length > 0) {
        await base44.entities.po_overrides.update(existing[0].id, {
          delayed_due_date: new_due_date,
          last_ddd_update_id: update.id,
        });
      } else {
        await base44.entities.po_overrides.create({
          po_number,
          delayed_due_date: new_due_date,
          last_ddd_update_id: update.id,
        });
      }

      return Response.json({ success: true, update });
    }

    // ── GENERAL_UPDATE ──────────────────────────────────────────
    if (action_type === 'GENERAL_UPDATE') {
      const { dd_status, general_comment, general_comment_other_text, next_update_date, current_dd_status } = payload;

      const update = await base44.entities.dd_updates.create({
        po_number,
        actor_email: user.email,
        type: 'GENERAL_UPDATE',
        dd_status: dd_status || null,
        general_comment: general_comment || null,
        general_comment_other_text: general_comment_other_text || null,
        next_update_date: next_update_date || null,
      });

      // Upsert po_overrides for dd_status + next_update_date
      const existing = await base44.entities.po_overrides.filter({ po_number });
      const statusChanged = dd_status && dd_status !== current_dd_status;
      const overrideData = {
        ...(dd_status ? { dd_status } : {}),
        ...(next_update_date ? { next_update_date } : {}),
        ...(statusChanged ? { dd_status_changed_at: new Date().toISOString() } : {}),
        last_general_update_id: update.id,
      };

      if (existing.length > 0) {
        await base44.entities.po_overrides.update(existing[0].id, overrideData);
      } else {
        await base44.entities.po_overrides.create({ po_number, ...overrideData });
      }

      return Response.json({ success: true, update });
    }

    // ── DECISION ────────────────────────────────────────────────
    if (action_type === 'DECISION') {
      const { decision, delay_response_comment, last_ddd_update_id } = payload;

      if (!decision || !last_ddd_update_id) {
        return Response.json({ error: 'decision and last_ddd_update_id are required' }, { status: 400 });
      }

      const validDecisions = ['APPROVED', 'REJECTED', 'ACKNOWLEDGED'];
      if (!validDecisions.includes(decision)) {
        return Response.json({ error: 'Invalid decision' }, { status: 400 });
      }

      await base44.entities.dd_updates.update(last_ddd_update_id, {
        status: decision,
        decision_at: new Date().toISOString(),
        decision_by_email: user.email,
        delay_response_comment: delay_response_comment || null,
      });

      return Response.json({ success: true });
    }

    // ── INTERNAL_NOTE ───────────────────────────────────────────
    if (action_type === 'INTERNAL_NOTE') {
      const { internal_note, last_ddd_update_id } = payload;

      if (!last_ddd_update_id) {
        return Response.json({ error: 'last_ddd_update_id is required' }, { status: 400 });
      }

      await base44.entities.dd_updates.update(last_ddd_update_id, {
        internal_note: internal_note || null,
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: `Unknown action_type: ${action_type}` }, { status: 400 });

  } catch (error) {
    console.error('saveFollowUpAction error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});