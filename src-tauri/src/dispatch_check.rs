//! The six commands, invoked through the real dispatcher.
//!
//! Everything else in this crate's tests calls [`WorkspaceSession`] directly,
//! which is where the behaviour lives — but it says nothing about the three
//! things only the dispatcher decides:
//!
//! 1. **Registration.** A command absent from `generate_handler!` is a runtime
//!    failure, not a compile one. Nothing in a direct call would notice.
//! 2. **Argument deserialization.** `id` arrives as JSON and has to become a
//!    `DocumentId`, and `MatchId` has to survive its hand-written
//!    `ContentRevision` deserializer. A direct call passes a typed value and
//!    proves nothing about the JSON.
//! 3. **The capability set.** `capabilities/default.json` is `"permissions":
//!    []`, narrowed by Phase 1b-1's review, and the question this phase had to
//!    answer is whether five new application commands need it widened. Reading
//!    `tauri`'s dispatcher and concluding that an application command from a
//!    local origin is not access-checked unless the application publishes an
//!    ACL manifest is an *argument*. Running one through the dispatcher with
//!    the real configuration and the real capability file is *evidence*, and
//!    1b-1's review is on file about a smoke test that proved nothing because
//!    it was never really exercising the path it claimed.
//!
//! `mock_builder()` swaps the platform webview for a mock; it does **not** swap
//! the IPC dispatcher, the access-control resolution or the command macros, all
//! of which are the same code the shipped binary runs. What it cannot say
//! anything about is rendering — `PROGRESS.md` R32 — and nothing here claims it
//! does.
//!
//! # The menu command, and the one thing these tests cannot reach
//!
//! Phase 1b-2b adds `set_menu_labels`, and it is the command the capability
//! question was raised about in the first place. It is driven here for all three
//! reasons above, and it answers the third one: a menu built by *Rust* on behalf
//! of the frontend needs **no** permission, where a menu built by the frontend
//! through `@tauri-apps/api/menu` would need `core:menu`'s.
//!
//! What these tests deliberately do not reach is the menu itself, and the reason
//! is worth stating because it decides how the menu tests below are written.
//! `muda::Menu` panics — *"`muda::Menu` can only be created on the main
//! thread"* — anywhere but the process's main thread. Two things were measured
//! rather than assumed: **libtest runs every `#[test]` on a spawned thread**,
//! even under `--test-threads=1`, and **`MockRuntime` runs a task posted with
//! `run_on_main_thread` inline on the calling thread**. So no test in this
//! harness can build a menu, whichever way `crate::menu` posts the work.
//!
//! The menu tests therefore stop one step earlier, at **label validation** —
//! which is exactly the step that separates the refusals the dispatcher can
//! produce, and so is enough to answer all three questions above:
//!
//! | Condition | Answer |
//! |---|---|
//! | not registered | the string `Command … not found` |
//! | refused by the access-control list | the string `… not allowed. Plugin not found` |
//! | registered, allowed, skewed labels | `{ "code": "invalidMenuLabels", … }` |
//!
//! The third row used to read ``invalid args `labels` for command …`` — Tauri's
//! command macro refusing to deserialize a typed argument, in English, with no
//! `code`. Phase 1b-2b's review found that this made a version skew untyped
//! prose reaching the webview, so `crate::menu` now takes an untyped envelope
//! and validates it itself. The row is stronger evidence than it was: an answer
//! that is **one of our codes** could only have come from the command's own
//! body, so the first two rows are ruled out by construction rather than by
//! telling three English sentences apart.
//!
//! **Nothing here claims a menu exists.** `docs/decisions/1b-2b-notes.md`
//! section 11 records that as a hole, with what closes it.

use std::fs;

use serde_json::{json, Value};
use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{get_ipc_response, mock_builder, MockRuntime, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::{App, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tempfile::TempDir;

/// Builds the application exactly as `main()` does, on the mock runtime.
///
/// Both the command registration and the compiled configuration come from
/// `main.rs`, so the application under test is the application that ships —
/// including `capabilities/default.json`, which is the point.
fn mock_app() -> App<MockRuntime> {
    crate::register(mock_builder())
        .build(crate::context())
        .expect("the application builds on the mock runtime")
}

/// The main window, whose label is the one the capability file names.
fn main_window(app: &App<MockRuntime>) -> WebviewWindow<MockRuntime> {
    WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
        .build()
        .expect("the mock webview builds")
}

/// The origin a real webview of this application has.
///
/// `tauri://localhost` is what the custom protocol serves on macOS, and it is
/// what `Webview::is_local_url` recognises as local. The distinction is not
/// cosmetic: the dispatcher access-checks **every** command from a non-local
/// origin, so getting this wrong would make the test below measure the remote
/// path while claiming to measure the local one. `a_remote_origin_is_refused`
/// pins the other side of that condition.
const LOCAL_ORIGIN: &str = "tauri://localhost";

/// Invokes one command over IPC from `origin`, returning the raw value.
fn invoke_from(
    webview: &WebviewWindow<MockRuntime>,
    origin: &str,
    command: &str,
    args: Value,
) -> Result<Value, Value> {
    let response = get_ipc_response(
        webview,
        InvokeRequest {
            cmd: command.to_owned(),
            callback: CallbackFn(0),
            error: CallbackFn(1),
            url: origin.parse().expect("an origin"),
            body: InvokeBody::Json(args),
            headers: Default::default(),
            invoke_key: INVOKE_KEY.to_string(),
        },
    );
    match response {
        Ok(body) => Ok(body
            .deserialize::<Value>()
            .expect("a command result is JSON")),
        Err(error) => Err(error),
    }
} // End of function invoke_from()

/// Invokes one command over IPC from the application's own origin.
fn invoke(
    webview: &WebviewWindow<MockRuntime>,
    command: &str,
    args: Value,
) -> Result<Value, Value> {
    invoke_from(webview, LOCAL_ORIGIN, command, args)
}

/// A complete menu label set, derived from the Rust declaration.
///
/// Built by reading the fields of `MenuLabels` out of `src-tauri/src/menu.rs`
/// rather than from a list written here, because a list written here would have
/// to be kept in step with the struct and the whole point of these tests is that
/// nothing has to be. The **values** are the field names: the command answers
/// nothing, so there is no rendering to observe, and what is under test is that
/// a complete object deserializes and an incomplete one does not.
fn every_label() -> Value {
    let source = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/menu.rs"))
        .expect("menu.rs can be read");
    let fields = crate::rust_source::declared_fields(&source, "MenuLabels");
    assert!(
        fields.len() > 10,
        "the field scan found {} labels, so it is not reading the declaration",
        fields.len()
    );
    Value::Object(
        fields
            .into_iter()
            .map(|field| (field.clone(), Value::String(field)))
            .collect(),
    )
} // End of function every_label()

/// A synthetic espanso tree. Neutral by hand; never the real configuration.
fn synthetic_tree() -> TempDir {
    let dir = TempDir::new().expect("temp dir");
    let root = dir.path();
    fs::create_dir_all(root.join("config")).unwrap();
    fs::create_dir_all(root.join("match")).unwrap();
    fs::write(root.join("config").join("default.yml"), "backend: auto\n").unwrap();
    fs::write(
        root.join("match").join("base.yml"),
        "matches:\n  - trigger: ':one'\n    replace: first\n",
    )
    .unwrap();
    dir
}

/// All five commands are reachable, in order, with `"permissions": []`.
///
/// Half of the answer to the capability question — the menu command is the
/// other half, below. If the empty capability set blocked an application
/// command, the very first `invoke` would
/// come back as a **string** — the dispatcher's rejection message — instead of
/// the object below, and every assertion after it would fail.
#[test]
fn the_five_commands_are_reachable_with_an_empty_capability_set() {
    let dir = synthetic_tree();
    let app = mock_app();
    let webview = main_window(&app);

    // 1. Before anything is open, the session refuses — and the refusal is our
    //    typed code, which is what tells an ACL denial from a real answer.
    let refusal = invoke(&webview, "list_documents", json!({}))
        .expect_err("no workspace is open yet, so this must fail");
    assert_eq!(
        refusal.get("code").and_then(Value::as_str),
        Some("noWorkspaceOpen"),
        "the dispatcher rejected before reaching the command: {refusal}"
    );

    // 2. open_workspace, with an argument that has to deserialize into an
    //    Option<PathBuf>.
    let summary = invoke(
        &webview,
        "open_workspace",
        json!({ "root": dir.path().to_string_lossy() }),
    )
    .expect("the synthetic tree opens");
    assert_eq!(summary["documents"], 2);
    assert_eq!(summary["match_files"], 1);

    // 3. list_documents.
    let documents = invoke(&webview, "list_documents", json!({})).expect("the workspace is open");
    let rows = documents.as_array().expect("a list of summaries");
    assert_eq!(rows.len(), 2);
    let document_id = rows
        .iter()
        .find(|row| {
            row["relative_path"]
                .as_str()
                .unwrap_or_default()
                .contains("base.yml")
        })
        .expect("the match file is listed")["id"]
        .clone();

    // 4. get_document, whose `id` argument arrives as a JSON number.
    let view =
        invoke(&webview, "get_document", json!({ "id": document_id })).expect("the document reads");
    assert_eq!(view["parsed"], true);
    assert_eq!(view["matches"].as_array().map(Vec::len), Some(1));

    // 5. get_match, whose `id` argument is a whole MatchId — including the
    //    ContentRevision that has a hand-written Deserialize.
    let identity = view["matches"][0]["id"].clone();
    let found = invoke(&webview, "get_match", json!({ "id": identity }))
        .expect("the identity is from this parse");
    assert_eq!(found["trigger"]["trigger"]["text"], ":one");

    // 6. reload_document.
    let reloaded =
        invoke(&webview, "reload_document", json!({ "id": document_id })).expect("the file reads");
    assert_eq!(reloaded["revision"], view["revision"]);
} // End of function the_five_commands_are_reachable_with_an_empty_capability_set()

/// The dispatcher's rejection when the access-control list refuses a command.
///
/// The three messages in the module's table were read off this dispatcher
/// rather than guessed, and telling them apart is what lets a test that never
/// reaches a command body still say the command was registered and allowed.
const NOT_ALLOWED: &str = "not allowed";

/// The dispatcher's rejection when `command` is not registered at all.
///
/// The **whole** phrase, and it has to be. The first version of this needle was
/// the bare words "not found", which the access-control refusal also contains —
/// it ends "Plugin not found" — so the disabling experiment for the test below
/// reported a capability denial as a missing registration. A check that fires
/// for the right input and names the wrong cause sends a reader to the wrong
/// file, which `1b-2b-notes.md` section 7 already recorded once this phase.
fn unregistered(command: &str) -> String {
    format!("Command {command} not found")
}

/// The menu command is registered, allowed, and refuses a skewed label set with
/// a code.
///
/// **The command Phase 1b-1's review predicted would need the first
/// permission.** It does not, and this test is why rather than an assertion
/// that it does not: the labels go to an **application** command, which the
/// dispatcher does not access-check from a local origin, and Rust builds the
/// menu itself. A frontend that built the menu through `@tauri-apps/api/menu`
/// would be calling `plugin:menu|…`, which *is* access-checked, and would need
/// `core:menu`'s permissions granted to the renderer.
///
/// **Why the payload is deliberately incomplete.** A complete one would build a
/// menu, which no test in this harness can do; the module documentation says
/// why, and both halves of the reason were measured. So the furthest point in
/// the pipeline a test here can reach is label validation — and reaching *that*
/// is stronger evidence than the three-refusal table it replaces: an answer that
/// is one of **our** codes can only have come from the command's own body, which
/// means the dispatcher found the command (not [`unregistered`]) and let it
/// through (not [`NOT_ALLOWED`]).
///
/// **Phase 1b-2b's review is why the assertion changed shape.** With
/// `labels: MenuLabels` in the signature the refusal came from Tauri's command
/// macro and carried no `code` at all — the old version of this test asserted
/// exactly that, and so pinned serde prose reaching the webview as though it
/// were the design. It is now the version-skew code, with the field it wanted.
#[test]
fn the_menu_command_is_registered_and_reachable_with_an_empty_capability_set() {
    let app = mock_app();
    let webview = main_window(&app);
    let mut labels = every_label();
    let removed = labels
        .as_object_mut()
        .expect("a label set is an object")
        .remove("quit");
    assert!(removed.is_some(), "the fixture must really drop a label");

    let error = invoke(&webview, "set_menu_labels", json!({ "labels": labels }))
        .expect_err("an incomplete label set must not build a menu");
    let message = error.as_str().unwrap_or_default();
    // The access-control refusal is tested for first: its text ends "Plugin not
    // found" and would satisfy the registration needle too.
    assert!(
        !message.contains(NOT_ALLOWED),
        "the empty capability set blocked set_menu_labels, so it needs a permission after all: {error}"
    );
    assert!(
        !message.contains(&unregistered("set_menu_labels")),
        "set_menu_labels is not registered: {error}"
    );
    assert_eq!(
        error.get("code").and_then(Value::as_str),
        Some("invalidMenuLabels"),
        "a version skew must be one of our codes, never the macro's English prose: {error}"
    );
    assert_eq!(
        error["missing"],
        json!(["quit"]),
        "the refusal names the field this build wanted: {error}"
    );
    assert_eq!(error["unexpected"], json!([]));
} // End of function the_menu_command_is_registered_and_reachable_with_an_empty_capability_set()

/// A label the Rust side does not declare is refused rather than dropped.
///
/// `deny_unknown_fields`, seen from the wire. A frontend that renamed a label
/// and forgot Rust would otherwise send sixteen strings, have one silently
/// ignored and one silently defaulted — except the default does not exist, so
/// this is really the second half of the check above, from the other direction.
#[test]
fn an_undeclared_menu_label_is_refused_at_the_boundary() {
    let app = mock_app();
    let webview = main_window(&app);
    let mut labels = every_label();
    labels
        .as_object_mut()
        .expect("a label set is an object")
        .insert("renamed_last_week".to_owned(), json!("Something"));

    let error = invoke(&webview, "set_menu_labels", json!({ "labels": labels }))
        .expect_err("an undeclared label must not be accepted");
    assert_eq!(
        error.get("code").and_then(Value::as_str),
        Some("invalidMenuLabels"),
        "an unknown label is our refusal, not the macro's: {error}"
    );
    assert_eq!(error["missing"], json!([]));
    assert_eq!(
        error["unexpected"],
        json!(["renamed_last_week"]),
        "the refusal names the field this build has never heard of: {error}"
    );
} // End of function an_undeclared_menu_label_is_refused_at_the_boundary()

/// An envelope that is not a label set at all is still one of our codes.
///
/// The shape a frontend from a different application would send. Before the
/// untyped envelope this was the command macro's `invalid args` sentence; the
/// point of the fix is that **every** refusal on this boundary is a code.
#[test]
fn a_menu_envelope_that_is_not_an_object_is_refused_with_a_code() {
    let app = mock_app();
    let webview = main_window(&app);
    let error = invoke(
        &webview,
        "set_menu_labels",
        json!({ "labels": "not an object" }),
    )
    .expect_err("a string is not a label set");
    assert_eq!(
        error.get("code").and_then(Value::as_str),
        Some("invalidMenuLabels"),
        "every refusal on this boundary is a code: {error}"
    );
    assert_eq!(
        error["missing"].as_array().map(Vec::len),
        Some(16),
        "every field is missing from something that is not an object: {error}"
    );
} // End of function a_menu_envelope_that_is_not_an_object_is_refused_with_a_code()

/// A page that is not this application cannot reach any of the six commands.
///
/// The other side of the condition the tests above depend on (`PROGRESS.md`
/// R20: pin both sides, never one inside). With `"permissions": []` and no
/// `remote` capability, the dispatcher access-checks every command from a
/// non-local origin and finds nothing that allows it — so a compromised or
/// navigated webview gets a refusal rather than the user's configuration
/// directory, and cannot rewrite the application's menu either. The refusal is a
/// **string**, not one of our codes, which is exactly why `classifyFailure` in
/// `src/lib/ipc/errors.ts` has an `unexpected` arm instead of assuming every
/// rejection is ours.
#[test]
fn a_remote_origin_is_refused() {
    let dir = synthetic_tree();
    let app = mock_app();
    let webview = main_window(&app);
    let attempts: Vec<(&str, Value)> = vec![
        (
            "open_workspace",
            json!({ "root": dir.path().to_string_lossy() }),
        ),
        ("set_menu_labels", json!({ "labels": every_label() })),
    ];
    for (command, args) in attempts {
        let error = invoke_from(&webview, "https://an-unrelated-site.example", command, args)
            .expect_err("a remote origin must not reach an application command");
        assert!(
            error.is_string(),
            "{command} must reject with the dispatcher's message, not with a code: {error}"
        );
        assert!(
            error.as_str().unwrap_or_default().contains(NOT_ALLOWED),
            "the refusal must say so: {error}"
        );
    } // End of the loop over the commands a remote page must not reach
} // End of function a_remote_origin_is_refused()

/// A malformed identity is a typed rejection, not a wrong match.
///
/// `ContentRevision`'s hand-written `Deserialize` accepts exactly 64 hex
/// characters. A token that is not one must fail at the boundary rather than
/// becoming a digest that quietly matches nothing (`1a-notes.md` section 9,
/// hole 6).
#[test]
fn a_malformed_revision_is_refused_at_the_boundary() {
    let dir = synthetic_tree();
    let app = mock_app();
    let webview = main_window(&app);
    invoke(
        &webview,
        "open_workspace",
        json!({ "root": dir.path().to_string_lossy() }),
    )
    .expect("the synthetic tree opens");

    let error = invoke(
        &webview,
        "get_match",
        json!({ "id": { "document": 0, "revision": "not-a-revision", "node": 1 } }),
    )
    .expect_err("a malformed revision must not resolve");
    // A deserialization failure is the command macro's own message rather than
    // one of our codes, which is exactly the case `classifyFailure` gives its
    // `unexpected` arm — so the assertion is that it is *not* a command error.
    assert!(
        error.get("code").is_none(),
        "a malformed argument should be refused by the macro, not carried into the command: {error}"
    );
} // End of function a_malformed_revision_is_refused_at_the_boundary()

/// A stale identity survives the round trip as its own code.
///
/// The R27 path over real IPC rather than over a direct call: the serialized
/// error has to reach the webview with `identityStaleRevision` intact, because
/// that string is what the frontend switches on.
#[test]
fn a_stale_identity_reaches_the_webview_as_its_own_code() {
    let dir = synthetic_tree();
    let app = mock_app();
    let webview = main_window(&app);
    invoke(
        &webview,
        "open_workspace",
        json!({ "root": dir.path().to_string_lossy() }),
    )
    .expect("the synthetic tree opens");
    let documents = invoke(&webview, "list_documents", json!({})).expect("the workspace is open");
    let document_id = documents
        .as_array()
        .expect("a list")
        .iter()
        .find(|row| {
            row["relative_path"]
                .as_str()
                .unwrap_or_default()
                .contains("base.yml")
        })
        .expect("the match file is listed")["id"]
        .clone();
    let view =
        invoke(&webview, "get_document", json!({ "id": document_id })).expect("the document reads");
    let identity = view["matches"][0]["id"].clone();

    fs::write(
        dir.path().join("match").join("base.yml"),
        "matches:\n  - trigger: ':changed'\n    replace: rewritten\n",
    )
    .unwrap();
    invoke(&webview, "reload_document", json!({ "id": document_id })).expect("the file reads");

    let error = invoke(&webview, "get_match", json!({ "id": identity }))
        .expect_err("the identity is from the previous parse");
    assert_eq!(
        error["code"], "identityStaleRevision",
        "the code the frontend switches on must survive the round trip: {error}"
    );
} // End of function a_stale_identity_reaches_the_webview_as_its_own_code()

/// What the main-thread step answers is what the work there actually did.
///
/// **The review's fifth finding, made falsifiable.** `set_menu_labels` used to
/// return as soon as the AppKit work had been *posted*, so a failure inside it
/// left the previous menu up and the caller was told `Ok`. No test in this
/// harness can make the real closure fail — `muda::Menu` needs the process's
/// main thread and libtest never provides one — so what is driven here is
/// `crate::menu::on_main_thread`, the step the command is built out of, with a
/// closure whose answer the test chooses.
///
/// Both arms are asserted, because only one of them can fail if the fix is
/// removed: a version that ignores the closure's result answers `Ok(())` for
/// both, and the `Err` arm is what says so.
///
/// It also runs the wait itself. `MockRuntime` executes a task posted with
/// `run_on_main_thread` inline while the event loop is not running, exactly as
/// `tauri_runtime_wry` does when the caller is already on the main thread, so a
/// version of this that could deadlock would hang this test rather than pass it.
#[test]
fn the_main_thread_step_reports_what_the_work_answered() {
    let app = mock_app();
    let handle = app.handle().clone();

    let succeeded = crate::menu::on_main_thread(&handle, || Ok(()));
    assert!(
        succeeded.is_ok(),
        "work that answered Ok must not become a failure: {succeeded:?}"
    );

    let failed = crate::menu::on_main_thread(&handle, || Err(()));
    assert_eq!(
        failed,
        Err(crate::error::CommandError::MenuBuildFailed),
        "work that answered Err must not be reported as a menu that was installed"
    );

    // Non-vacuity: the closure really ran, on whatever thread the runtime chose,
    // rather than the channel answering by default.
    let ran = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let flag = std::sync::Arc::clone(&ran);
    let _ = crate::menu::on_main_thread(&handle, move || {
        flag.store(true, std::sync::atomic::Ordering::SeqCst);
        Ok(())
    });
    assert!(ran.load(std::sync::atomic::Ordering::SeqCst));
} // End of function the_main_thread_step_reports_what_the_work_answered()
