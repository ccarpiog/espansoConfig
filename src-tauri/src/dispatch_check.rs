//! The five commands, invoked through the real dispatcher.
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
/// The single test that answers the capability question. If the empty
/// capability set blocked an application command, the very first `invoke` would
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

/// A page that is not this application cannot reach any of the five commands.
///
/// The other side of the condition the test above depends on (`PROGRESS.md`
/// R20: pin both sides, never one inside). With `"permissions": []` and no
/// `remote` capability, the dispatcher access-checks every command from a
/// non-local origin and finds nothing that allows it — so a compromised or
/// navigated webview gets a refusal rather than the user's configuration
/// directory. The refusal is a **string**, not one of our codes, which is
/// exactly why `classifyFailure` in `src/lib/ipc/errors.ts` has an `unexpected`
/// arm instead of assuming every rejection is ours.
#[test]
fn a_remote_origin_is_refused() {
    let dir = synthetic_tree();
    let app = mock_app();
    let webview = main_window(&app);
    let error = invoke_from(
        &webview,
        "https://an-unrelated-site.example",
        "open_workspace",
        json!({ "root": dir.path().to_string_lossy() }),
    )
    .expect_err("a remote origin must not reach an application command");
    assert!(
        error.is_string(),
        "a refused command rejects with the dispatcher's message, not with a code: {error}"
    );
    assert!(
        error.as_str().unwrap_or_default().contains("not allowed"),
        "the refusal must say so: {error}"
    );
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
