import { FormSubmitButton } from "@/app/components/form-submit-button";
import { getElasticEmailCredentials, getOpenAICredentials, getPlanningCenterCredentials, getTwilioCredentials } from "@/lib/settings";
import { getSyncQueueStats, listPlanningCenterFieldMap } from "@/lib/planning-center-writeback";
import { DEFAULT_CATEGORY_THRESHOLDS, getOpenAIModerationThresholds } from "@/lib/openai-moderation";
import { listModerationBlocklist, listModerationKeywords } from "@/lib/moderation";
import {
  bulkSyncPlanningCenterAction,
  processSyncQueueAction,
  pushCampaignTotalsWritebackAction,
  saveFieldMapAction,
  savePcoCredentialsAction
} from "./planning-center/actions";
import {
  saveBlocklistAction,
  saveKeywordListAction,
  saveOpenAIKeyAction,
  saveOpenAIThresholdsAction
} from "./moderation/actions";
import {
  saveElasticEmailCredentialsAction,
  saveTwilioCredentialsAction
} from "./notifications/actions";

function activeTerms(items: { keyword: string; isActive: boolean }[]) {
  return items.filter((item) => item.isActive).map((item) => item.keyword).join(", ");
}

export async function AdminSettingsIntegrations() {
  const [pco, fieldMap, queueStats, email, twilio, keywords, blocklist, openai, thresholds] = await Promise.all([
    getPlanningCenterCredentials(),
    listPlanningCenterFieldMap(),
    getSyncQueueStats(),
    getElasticEmailCredentials(),
    getTwilioCredentials(),
    listModerationKeywords(),
    listModerationBlocklist(),
    getOpenAICredentials(),
    getOpenAIModerationThresholds()
  ]);

  return (
    <section className="space-y-8">
      <div>
        <p className="plc-eyebrow">Advanced settings</p>
        <h2 className="mt-2 text-3xl font-black uppercase text-white">Connections and safety</h2>
        <p className="plc-copy mt-2 max-w-3xl">
          These settings connect outside services and control how prayer requests are checked. Most staff will not need
          to change them. Ask a system administrator before changing credentials or safety thresholds.
        </p>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="plc-panel p-6">
          <h3 className="text-2xl font-black uppercase text-white">Church directory connection</h3>
          <p className="plc-copy mt-2">
            Connect the church directory so staff can find people and refresh household and friends lists. Status: {" "}
            <span className="font-black text-yellow">{pco.configured ? "Connected" : "Not connected"}</span>.
          </p>
          <form action={savePcoCredentialsAction} className="mt-5 space-y-4">
            <label className="plc-label block space-y-2">
              <span>Application ID</span>
              <input required name="app_id" defaultValue={pco.appId ?? ""} className="plc-input w-full px-4 py-3 font-mono text-sm" autoComplete="off" />
            </label>
            <label className="plc-label block space-y-2">
              <span>Secret</span>
              <input required name="secret" type="password" defaultValue={pco.secret ?? ""} className="plc-input w-full px-4 py-3 font-mono text-sm" autoComplete="off" />
            </label>
            <FormSubmitButton pendingLabel="Saving directory connection…">Save and test connection</FormSubmitButton>
          </form>
        </article>

        <article className="plc-panel p-6">
          <h3 className="text-2xl font-black uppercase text-white">Prayer totals in the church directory</h3>
          <p className="plc-copy mt-2">
            Map the two optional fields used for total minutes pledged and total minutes prayed. These values are written
            automatically when staff or members record activity.
          </p>
          <div className="mt-5 space-y-4">
            {fieldMap.map((field) => (
              <form key={field.fieldKey} action={saveFieldMapAction} className="grid gap-3 rounded-xl border border-white/10 bg-black/25 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <input type="hidden" name="field_key" value={field.fieldKey} />
                <div>
                  <p className="font-black text-white">{field.label}</p>
                  <p className="mt-1 font-mono text-xs text-white/50">Internal field: {field.fieldKey}</p>
                </div>
                <label className="plc-label block space-y-2">
                  <span>Directory field ID</span>
                  <input name="planning_center_field_id" defaultValue={field.planningCenterFieldId ?? ""} placeholder="Field ID" className="plc-input w-full px-3 py-2 font-mono text-sm" />
                </label>
                <FormSubmitButton pendingLabel="Saving…" className="plc-button-secondary">Save</FormSubmitButton>
              </form>
            ))}
          </div>
        </article>

        <article className="plc-panel p-6">
          <h3 className="text-2xl font-black uppercase text-white">Directory synchronization</h3>
          <p className="plc-copy mt-2">
            Refresh connected member lists or send campaign totals to the church directory. These actions can take time;
            run them outside busy staff hours when possible.
          </p>
          <p className="mt-3 text-sm text-white/75">
            Pending {queueStats.pending} · Completed {queueStats.done} · Skipped {queueStats.skipped} · Errors {queueStats.error}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <form action={bulkSyncPlanningCenterAction}><button className="plc-button" disabled={!pco.configured}>Sync all people</button></form>
            <form action={processSyncQueueAction}><button className="plc-button-secondary" disabled={!pco.configured}>Process pending sync jobs</button></form>
            <form action={pushCampaignTotalsWritebackAction}><button className="plc-button-secondary" disabled={!pco.configured}>Send campaign totals</button></form>
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="plc-panel p-6">
          <h3 className="text-2xl font-black uppercase text-white">Email delivery</h3>
          <p className="plc-copy mt-2">Connect the service used to send sign-in emails and optional prayer-request updates.</p>
          <form action={saveElasticEmailCredentialsAction} className="mt-5 space-y-4">
            <label className="plc-label block space-y-2"><span>API key</span><input required name="api_key" type="password" defaultValue={email.apiKey ?? ""} className="plc-input w-full px-4 py-3 font-mono text-sm" autoComplete="off" /></label>
            <label className="plc-label block space-y-2"><span>From email</span><input required name="from_email" type="email" defaultValue={email.fromEmail ?? ""} className="plc-input w-full px-4 py-3" /></label>
            <label className="plc-label block space-y-2"><span>From name</span><input name="from_name" defaultValue={email.fromName ?? "Pray Like Crazy"} className="plc-input w-full px-4 py-3" /></label>
            <FormSubmitButton pendingLabel="Saving email connection…">Save and verify email</FormSubmitButton>
          </form>
        </article>

        <article className="plc-panel p-6">
          <h3 className="text-2xl font-black uppercase text-white">Text message delivery</h3>
          <p className="plc-copy mt-2">Connect the service used for phone sign-in codes and optional campaign messages.</p>
          <form action={saveTwilioCredentialsAction} className="mt-5 space-y-4">
            <label className="plc-label block space-y-2"><span>Account SID</span><input required name="account_sid" defaultValue={twilio.accountSid ?? ""} className="plc-input w-full px-4 py-3 font-mono text-sm" autoComplete="off" /></label>
            <label className="plc-label block space-y-2"><span>Auth token</span><input required name="auth_token" type="password" defaultValue={twilio.authToken ?? ""} className="plc-input w-full px-4 py-3 font-mono text-sm" autoComplete="off" /></label>
            <label className="plc-label block space-y-2"><span>Verify service ID for sign-in codes</span><input name="verify_service_sid" defaultValue={twilio.verifyServiceSid ?? ""} placeholder="VAxxxxxxxx…" className="plc-input w-full px-4 py-3 font-mono text-sm" autoComplete="off" /></label>
            <label className="plc-label block space-y-2"><span>From number for text messages</span><input name="from_number" defaultValue={twilio.fromNumber ?? ""} placeholder="+12605551212" className="plc-input w-full px-4 py-3 font-mono text-sm" /></label>
            <FormSubmitButton pendingLabel="Saving text connection…">Save and verify text messages</FormSubmitButton>
          </form>
        </article>
      </section>

      <section className="space-y-6">
        <div>
          <h3 className="text-2xl font-black uppercase text-white">Prayer request safety</h3>
          <p className="plc-copy mt-2">These rules help keep the community board safe. Change them only with the church leadership team.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <article className="plc-panel p-6 border-danger/30">
            <h4 className="text-xl font-black uppercase text-danger">Blocked words</h4>
            <p className="plc-copy mt-2 text-sm">Requests containing these words are not saved and the person is asked to reword the request.</p>
            <form action={saveBlocklistAction} className="mt-5 space-y-4">
              <textarea name="blocklist" rows={8} defaultValue={activeTerms(blocklist)} className="plc-input min-h-[10rem] w-full px-3 py-2 font-mono text-sm normal-case tracking-normal" placeholder="One term or phrase, separated by commas" />
              <FormSubmitButton pendingLabel="Saving blocked words…">Save blocked words</FormSubmitButton>
            </form>
          </article>
          <article className="plc-panel p-6">
            <h4 className="text-xl font-black uppercase text-white">Church-specific review words</h4>
            <p className="plc-copy mt-2 text-sm">Requests containing these terms are saved privately for staff review.</p>
            <form action={saveKeywordListAction} className="mt-5 space-y-4">
              <textarea name="keywords" rows={8} defaultValue={activeTerms(keywords)} className="plc-input min-h-[10rem] w-full px-3 py-2 font-mono text-sm normal-case tracking-normal" placeholder="One term or phrase, separated by commas" />
              <FormSubmitButton pendingLabel="Saving review words…">Save review words</FormSubmitButton>
            </form>
          </article>
          <article className="plc-panel p-6">
            <h4 className="text-xl font-black uppercase text-yellow">Automated safety check</h4>
            <p className="plc-copy mt-2 text-sm">Connect the automated check used to identify potentially harmful or unsafe content.</p>
            <form action={saveOpenAIKeyAction} className="mt-5 space-y-4">
              <label className="plc-label block space-y-2"><span>Safety-check API key</span><input type="password" name="openai_api_key" autoComplete="off" placeholder={openai.configured ? "Leave blank to keep current key" : "Enter key"} className="plc-input w-full px-3 py-2 font-mono text-sm" /></label>
              <FormSubmitButton pendingLabel="Saving safety connection…">Save safety connection</FormSubmitButton>
            </form>
          </article>
        </div>

        <article className="plc-panel p-6">
          <h4 className="text-xl font-black uppercase text-white">Automated review thresholds</h4>
          <p className="plc-copy mt-2 max-w-3xl text-sm">Use the default thresholds unless your leadership team has approved a change. Scores range from 0 to 1; lower scores are more sensitive.</p>
          <form action={saveOpenAIThresholdsAction} className="mt-5 space-y-5">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
                <thead><tr className="border-b border-white/15 text-xs font-black uppercase text-white/65"><th className="py-2 pr-3">Category</th><th className="py-2 pr-3">Review at</th><th className="py-2 pr-3">Block at</th><th className="py-2">Recommended action</th></tr></thead>
                <tbody>
                  {thresholds.categories.map((row) => {
                    const def = DEFAULT_CATEGORY_THRESHOLDS.find((item) => item.category === row.category);
                    const neverBlock = def?.block === null;
                    return <tr key={row.category} className="border-b border-white/10"><td className="py-3 pr-3 font-mono text-xs">{row.category}</td><td className="py-3 pr-3"><input type="number" name={`review__${row.category}`} min={0} max={1} step={0.01} defaultValue={row.review ?? ""} placeholder={def?.review != null ? String(def.review) : "—"} className="plc-input w-24 px-2 py-1.5 font-mono text-sm" /></td><td className="py-3 pr-3">{neverBlock ? <><input type="hidden" name={`block__${row.category}`} value="" /><span className="text-xs text-white/60">Never block</span></> : <input type="number" name={`block__${row.category}`} min={0} max={1} step={0.01} defaultValue={row.block ?? ""} placeholder={def?.block != null ? String(def.block) : "—"} className="plc-input w-24 px-2 py-1.5 font-mono text-sm" />}</td><td className="py-3"><input type="text" name={`action__${row.category}`} defaultValue={row.recommendedAction} className="plc-input w-full min-w-[14rem] px-2 py-1.5 text-sm normal-case tracking-normal" /></td></tr>;
                  })}
                </tbody>
              </table>
            </div>
            <label className="flex items-start gap-3 text-sm text-white/80"><input type="checkbox" name="flagged_means_review" value="true" defaultChecked={thresholds.flaggedMeansReview} className="plc-checkbox mt-0.5" /><span>Hold a request for private review if the automated check flags it, even when no single category crosses a threshold.</span></label>
            <div className="flex flex-wrap gap-2"><FormSubmitButton pendingLabel="Saving thresholds…">Save review thresholds</FormSubmitButton><button className="plc-button-secondary" type="submit" name="reset_defaults" value="1">Reset to defaults</button></div>
          </form>
        </article>
      </section>
    </section>
  );
}
