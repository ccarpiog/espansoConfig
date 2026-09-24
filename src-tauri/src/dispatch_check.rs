//! The twenty commands, invoked through the real dispatcher.
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
//! 3. **The capability set.** `capabilities/default.json` holds exactly two
//!    entries, `core:event:allow-listen` and `core:event:allow-unlisten`, and no
//!    entry for any application command — Phase 1b-1's review narrowed it to
//!    empty, and Phase 2d-5-7a widened it by those two when `AppShell.svelte`
//!    first registered the frontend's event listener. Two questions follow, and
//!    both are asked here. Whether an application command needs an entry:
//!    reading `tauri`'s dispatcher and concluding that an application command
//!    from a local origin is not access-checked unless the application
//!    publishes an ACL manifest is an *argument*; running one through the
//!    dispatcher with the real configuration and the real capability file is
//!    *evidence*, and 1b-1's review is on file about a smoke test that proved
//!    nothing because it was never really exercising the path it claimed. And
//!    whether the two entries grant exactly what the listener needs and nothing
//!    more: `plugin:event|listen` and `plugin:event|unlisten` are driven from
//!    the local origin, `plugin:event|emit` and `plugin:event|emit_to` — which
//!    `core:event:default` would also have granted — are asserted refused
//!    through the resolved access-control list, and every plugin command is in
//!    the remote-origin sweep beside the twenty application commands.
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
//!
//! # The seventh command, and the fourth thing only the dispatcher decides
//!
//! Phase 1c-2b-2a adds `document_text`, the first command whose answer is a
//! file's **own text** rather than a projection of it, and one wire field,
//! `UnknownEntry.value_text`, which is a slice of that text. That makes a
//! fourth question this harness is the right place to ask: *does a file's text
//! survive the crossing?*
//!
//! **The contract being measured is narrower than "bytes".** The wire type is a
//! JSON string, so what is pinned here is *exact preservation of valid UTF-8*. A
//! file that is not valid UTF-8 is refused in the core, before either value can
//! be built, and crosses as the typed `notUtf8` code; it cannot be carried and
//! is not decoded lossily. See [`crate::commands::WorkspaceSession::text`].
//!
//! Everything else on this wire is a model, so a normalisation would show up as
//! a wrong field. A document's text has no fields, and the corpus deliberately
//! contains bytes that editors, formatters, Unicode normalisers and JSON
//! encoders each have an opinion about — CRLF endings, a leading UTF-8 BOM, a
//! missing final newline, precomposed **and** decomposed `é`, an astral
//! character and a block scalar's real trailing spaces. Reasoning that
//! `serde_json` escapes `\r` and `\n` and that a parser reverses those escapes
//! is an *argument*; copying the fifteen byte-exact fixtures of `CLAUDE.md`
//! section 4 into a workspace, asking for each one over IPC and comparing the
//! answer with `std::fs::read` of the same file is *evidence*, and that is what
//! `document_text_answers_every_synthetic_fixture_byte_for_byte` does.
//! `an_unmodelled_entrys_value_text_crosses_the_dispatcher_byte_for_byte` asks
//! the same question of the second value, through `get_document`, because a
//! regression confined to serializing a `DocumentView` would leave the bare
//! string of `document_text` perfectly correct.
//!
//! Phase 2c-4a-1 adds a **third** such value — `SaveResult::Conflict::disk_text`,
//! a whole file's text carried on a save's answer rather than on a read's — and
//! `a_conflicts_disk_text_crosses_the_dispatcher_byte_for_byte` asks the same
//! question of it, for the same reason: that value has its own serializer arm,
//! reached only by a save that conflicts, so nothing the two sweeps above measure
//! covers it.
//!
//! What this still cannot see is the webview: `mock_builder()` swaps the
//! platform webview out, so what is measured is the response body Tauri
//! produces, up to and including its JSON encoding and decoding. A defect in
//! WKWebView's own string handling, or in `postMessage`, would be invisible
//! here, and `docs/decisions/1c-2b-2a-notes.md` section 4.3 records that as a
//! named limitation rather than an implication. **No doc comment, test name or
//! assertion message in this repository may say what "the webview receives".**

use std::fs;

use serde_json::{json, Value};
use tauri::ipc::{CallbackFn, InvokeBody, Origin};
use tauri::test::{get_ipc_response, mock_builder, MockRuntime, INVOKE_KEY};
use tauri::utils::acl::ExecutionContext;
use tauri::webview::InvokeRequest;
use tauri::{App, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
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

/// The origin a page that is not this application would have.
///
/// Any non-local URL would do; this one is spelled so that a failure message
/// names something recognisably foreign. It is what `a_remote_origin_is_refused`
/// sweeps with, and what the capability test resolves the access-control list
/// against, so the two measure the same origin.
const REMOTE_ORIGIN: &str = "https://an-unrelated-site.example";

/// The event plugin's registration command, as `@tauri-apps/api/event`'s
/// `listen` spells it.
///
/// A **plugin** command, which is what separates it from the twenty: the
/// dispatcher access-checks it even from the local origin, so it is reachable
/// only because `capabilities/default.json` grants `core:event:allow-listen`.
const EVENT_LISTEN: &str = "plugin:event|listen";

/// The event plugin's removal command, as the unlisten function `listen`
/// resolves with spells it — granted by the separate `core:event:allow-unlisten`.
const EVENT_UNLISTEN: &str = "plugin:event|unlisten";

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

/// The arguments `@tauri-apps/api/event`'s `listen` really sends, for this
/// application's one event.
///
/// Read off `node_modules/@tauri-apps/api/event.js` rather than guessed: `event`
/// is the name, `target` is `{ "kind": "Any" }` when `listen` is given no
/// options — which is how `src/lib/ipc/events.ts` calls it — and `handler` is
/// the callback identifier `transformCallback` would have minted, which the mock
/// runtime never invokes. The name is [`crate::events::RECONCILIATION_READY`],
/// the one Rust emits, so what is registered here is the listener the shipped
/// window registers and not a name written in this file. `handler` is the
/// callback identifier to send.
fn listen_arguments(handler: u32) -> Value {
    json!({
        "event": crate::events::RECONCILIATION_READY,
        "target": { "kind": "Any" },
        "handler": handler,
    })
}

/// The arguments the unlisten function sends: the event name and the identifier
/// `plugin:event|listen` answered, under the camelCase key the plugin's
/// `event_id` parameter is renamed to on the wire.
fn unlisten_arguments(event_id: u64) -> Value {
    json!({
        "event": crate::events::RECONCILIATION_READY,
        "eventId": event_id,
    })
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

/// A mock application with a one-file tree open, and that file already read.
///
/// **The two handles are owned**, so nothing in here borrows anything else: an
/// [`App`] and a [`WebviewWindow`] can both be moved out of the function that
/// built them. `_app` and `_dir` are never read again and are kept only because
/// dropping either would take away, respectively, the runtime the window answers
/// on and the files the session has open — which is why a caller must bind them
/// rather than discard them with `..`.
struct OverIpc {
    /// The window every `invoke` goes through.
    webview: WebviewWindow<MockRuntime>,
    /// The one document's identity, as it crossed the wire.
    document_id: Value,
    /// That document's projection, as it crossed the wire.
    view: Value,
    /// The application, kept alive for as long as its window is used.
    _app: App<MockRuntime>,
    /// The tree, kept alive for as long as the session may read it.
    _dir: TempDir,
}

/// A tree whose one match file holds `source`, opened over the real dispatcher.
///
/// The preamble every write-path test below began with, in one step: a temporary
/// tree, the application built on the mock runtime exactly as `main()` builds it,
/// its main window, then `open_workspace`, `list_documents` and `get_document`
/// for the one row that comes back. All six are the fixture rather than the
/// claim; each test states its own claim after them.
fn opened_over_ipc(source: &str) -> OverIpc {
    let dir = TempDir::new().expect("temp dir");
    fs::create_dir_all(dir.path().join("match")).unwrap();
    fs::write(dir.path().join("match").join("base.yml"), source).unwrap();
    let app = mock_app();
    let webview = main_window(&app);
    invoke(
        &webview,
        "open_workspace",
        json!({ "root": dir.path().to_string_lossy() }),
    )
    .expect("the tree opens");
    let rows = invoke(&webview, "list_documents", json!({}))
        .expect("the workspace is open")
        .as_array()
        .expect("a list of summaries")
        .clone();
    let document_id = rows[0]["id"].clone();
    let view =
        invoke(&webview, "get_document", json!({ "id": document_id })).expect("the document reads");
    OverIpc {
        webview,
        document_id,
        view,
        _app: app,
        _dir: dir,
    }
} // End of function opened_over_ipc()

/// All six read-only commands are reachable, in order, with a capability set
/// that names no application command.
///
/// Half of the answer to the capability question — the menu command is the
/// other half, below. `capabilities/default.json` grants two event-plugin
/// permissions and nothing else, so if an application command needed an entry
/// of its own, the very first `invoke` would come back as a **string** — the
/// dispatcher's rejection message — instead of the object below, and every
/// assertion after it would fail.
///
/// `document_text` is the sixth, added at Phase 1c-2b-2a, and it is driven here
/// for the same reason as the other five rather than argued to be like them: a
/// command absent from `generate_handler!` is a runtime failure and nothing in a
/// direct call to [`WorkspaceSession::text`] would notice. What its answer
/// *contains* is a separate question, asked over the byte-exact corpus below.
#[test]
fn the_six_read_only_commands_are_reachable_with_no_application_permission() {
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

    // 6. document_text, whose answer is a bare JSON string rather than an
    //    object — the one shape on this surface that is not a model.
    let text = invoke(&webview, "document_text", json!({ "id": document_id }))
        .expect("the document's bytes read");
    assert_eq!(
        text.as_str(),
        Some("matches:\n  - trigger: ':one'\n    replace: first\n"),
        "document_text must answer the file, not a projection of it: {text}"
    );

    // 7. reload_document.
    let reloaded =
        invoke(&webview, "reload_document", json!({ "id": document_id })).expect("the file reads");
    assert_eq!(reloaded["revision"], view["revision"]);
} // End of function the_six_read_only_commands_are_reachable_with_no_application_permission()

/// The one command that writes is reachable, and its answer is a flat outcome.
///
/// **The measurement Phase 2b-2a owes**, and it is three claims a direct call to
/// [`crate::commands::WorkspaceSession::move_match`] cannot make.
///
/// 1. **It is registered and a capability set naming no application command
///    does not block it.** A command absent from `generate_handler!` comes back
///    as the dispatcher's rejection *string*; an ACL denial does the same. Both
///    are told from a real answer by the answer being a JSON object with an
///    `outcome`.
/// 2. **Its arguments deserialize from the shapes the frontend really sends** —
///    a whole `MatchId` for `id`, a `null` for `after`, a **camelCase**
///    `baseRevision` for the snake_case parameter Tauri renames, and an
///    `Acknowledgement` that arrives as `{ "accepted": [] }` and goes through
///    that type's hand-written `Deserialize`. A wrong argument name is refused
///    inside Tauri's command macro, in English, with no code — which is what
///    `set_menu_labels` was changed to avoid at 1b-2b.
/// 3. **`SaveResult` crosses flat**, with `outcome` beside its operands rather
///    than as a one-key object, and the identity it answers with resolves through
///    `get_match` **across the dispatcher** rather than only in Rust.
#[test]
fn move_match_is_reachable_and_answers_a_flat_outcome() {
    let OverIpc {
        webview,
        document_id,
        view,
        _app,
        _dir,
    } = opened_over_ipc(
        "matches:\n  - trigger: ':one'\n    replace: first\n  - trigger: ':two'\n    replace: second\n",
    );
    let held = view["matches"][1]["id"].clone();

    let answer = invoke(
        &webview,
        "move_match",
        json!({
            "id": held,
            "after": Value::Null,
            "baseRevision": view["revision"],
            "acknowledgement": { "accepted": [] },
        }),
    )
    .expect("the move is legal");

    assert_eq!(
        answer["outcome"], "saved",
        "the outcome must be a flat discriminant, not a tag: {answer}"
    );
    assert_eq!(answer["committed"], true);
    assert_eq!(answer["backup_taken"], true);
    assert_eq!(answer["notes"], json!([]));
    assert!(
        answer["moved"].is_object(),
        "a committed move names the item it moved: {answer}"
    );
    assert_ne!(answer["revision"], view["revision"]);

    // The identity the command minted resolves, across the dispatcher, to the
    // snippet that moved — and the one held before the save does not.
    let found = invoke(&webview, "get_match", json!({ "id": answer["moved"] }))
        .expect("the answered identity resolves");
    assert_eq!(found["trigger"]["trigger"]["text"], ":two");
    let stale = invoke(&webview, "get_match", json!({ "id": held }))
        .expect_err("an identity from the previous revision must not resolve");
    assert_eq!(
        stale.get("code").and_then(Value::as_str),
        Some("identityStaleRevision"),
        "the refusal must be our typed code: {stale}"
    );

    // And the file really moved, on the disk rather than in a projection.
    let text = invoke(&webview, "document_text", json!({ "id": document_id }))
        .expect("the document's bytes read");
    assert_eq!(
        text.as_str(),
        Some("matches:\n  - trigger: ':two'\n    replace: second\n  - trigger: ':one'\n    replace: first\n")
    );
} // End of function move_match_is_reachable_and_answers_a_flat_outcome()

/// The second command that writes is reachable, and its draft deserializes from
/// the shape the frontend really sends.
///
/// **The measurement Phase 2b-2b-3 owes**, and it is four claims a direct call to
/// [`crate::commands::WorkspaceSession::save_match`] cannot make.
///
/// 1. **It is registered and a capability set naming no application command
///    does not block it.**
/// 2. **A whole `MatchDraft` deserializes off the wire**, from a JSON object that
///    names one field and omits the other twenty — every field carries
///    `#[serde(default)]`, so an omitted one is `Unchanged` and contributes no
///    edit. A draft that had to be sent whole would make every save a rewrite of
///    every field.
/// 3. **`DraftField` crosses externally tagged**, as `{ "Set": … }`, which is the
///    one shape a frontend cannot guess from the Rust type alone.
/// 4. **A refused draft crosses as `draftRefused` in the `Err` channel**, with the
///    core's refusal whole underneath it — and, unlike a gate refusal, with no
///    findings to hand back.
#[test]
fn save_match_is_reachable_and_its_draft_deserializes_from_the_wire() {
    let OverIpc {
        webview,
        document_id,
        view,
        _app,
        _dir,
    } = opened_over_ipc("matches:\n  - trigger: ':one'\n    replace: first\n");
    let held = view["matches"][0]["id"].clone();

    let answer = invoke(
        &webview,
        "save_match",
        json!({
            "id": held,
            // One field named, twenty omitted, and the omitted ones are
            // `Unchanged` rather than absent values to be written.
            "draft": { "replace": { "Set": "changed" } },
            "baseRevision": view["revision"],
            "acknowledgement": { "accepted": [] },
        }),
    )
    .expect("the draft plans and the save runs");

    assert_eq!(
        answer["outcome"], "saved",
        "the outcome must be a flat discriminant, not a tag: {answer}"
    );
    assert_eq!(answer["committed"], true);
    assert_eq!(answer["backup_taken"], true);
    assert!(
        answer["moved"].is_object(),
        "a committed save names the match it saved: {answer}"
    );

    // Only the drafted value moved. The trigger the draft never mentioned is
    // written exactly as it was, quotes included.
    let text = invoke(&webview, "document_text", json!({ "id": document_id }))
        .expect("the document's bytes read");
    assert_eq!(
        text.as_str(),
        Some("matches:\n  - trigger: ':one'\n    replace: changed\n")
    );

    // And a draft the planner refuses is an `Err` carrying our own code, with
    // the core's refusal whole underneath it and no findings anywhere.
    let refreshed =
        invoke(&webview, "get_document", json!({ "id": document_id })).expect("the document reads");
    let refusal = invoke(
        &webview,
        "save_match",
        json!({
            "id": refreshed["matches"][0]["id"],
            "draft": { "search_terms": [{ "index": 0, "value": { "Set": "late" } }] },
            "baseRevision": refreshed["revision"],
            "acknowledgement": { "accepted": [] },
        }),
    )
    .expect_err("a list this match does not have cannot be drafted into existence");
    assert_eq!(
        refusal.get("code").and_then(Value::as_str),
        Some("draftRefused"),
        "the refusal must be our typed code: {refusal}"
    );
    assert_eq!(refusal["error"]["SequenceItemDoesNotExist"]["length"], 0);
    assert!(
        refusal.get("findings").is_none(),
        "a planning refusal has nothing to acknowledge: {refusal}"
    );
} // End of function save_match_is_reachable_and_its_draft_deserializes_from_the_wire()

/// The third and fourth commands that write are reachable, and their arguments
/// deserialize from the shapes the frontend really sends.
///
/// **The measurement Phase 2b-2c-2 owes**, and it is four claims a direct call to
/// [`crate::commands::WorkspaceSession::create_match`] cannot make.
///
/// 1. **Both are registered and a capability set naming no application command
///    does not block them.**
/// 2. **`NewMatch` deserializes off the wire.** The payload here names the two
///    **required** typed alternatives — `{"trigger": {"Single": …}, "content":
///    {"Replace": …}}`, the shape since Phase 3-4 — and none of the twelve
///    optional fields, so this also pins that the omitted keys default to absent
///    rather than to empty, which the written bytes below assert. An object
///    missing one of the two required keys, or still in the pre-3-4 flat shape
///    (`"replace"` beside a string `"trigger"`), is refused *inside Tauri's
///    command macro*, which is why a caller sends both or sends nothing. The wide
///    payloads are measured at `commands.rs`'s
///    `a_wide_creation_reaches_the_disk_in_crlf_and_without_a_final_newline`.
/// 3. **`NewMatchPosition` crosses as a one-key object for every arm**, including
///    the two that carry nothing. `{"End":{}}` is the shape a Rust struct variant
///    with empty braces produces; a unit variant would have wanted the bare string
///    `"End"`, and a frontend cannot guess which from the type alone.
/// 4. **A deletion answers `moved: null`** — over the dispatcher, where the field
///    is written rather than omitted, so a caller can tell "no identity" from
///    "this build does not send one".
#[test]
fn create_and_delete_match_are_reachable_and_their_arguments_deserialize() {
    let OverIpc {
        webview,
        document_id,
        view,
        _app,
        _dir,
    } = opened_over_ipc("matches:\n  - trigger: ':one'\n    replace: first\n");

    let created = invoke(
        &webview,
        "create_match",
        json!({
            "document": document_id,
            "newMatch": {
                "trigger": { "Single": ":new" },
                "content": { "Replace": "a new snippet" },
            },
            // The operand-less arm, as the object a struct variant writes.
            "position": { "End": {} },
            "baseRevision": view["revision"],
            "acknowledgement": { "accepted": [] },
        }),
    )
    .expect("the creation is legal");
    assert_eq!(
        created["outcome"], "saved",
        "the outcome must be a flat discriminant, not a tag: {created}"
    );
    assert_eq!(created["committed"], true);
    assert!(
        created["moved"].is_object(),
        "a committed creation names the snippet it created: {created}"
    );

    // The bytes really changed, on the disk rather than in a projection, and the
    // snippet that was already there is byte-identical.
    let text = invoke(&webview, "document_text", json!({ "id": document_id }))
        .expect("the document's bytes read");
    assert_eq!(
        text.as_str(),
        Some(
            "matches:\n  - trigger: ':one'\n    replace: first\n  - trigger: ':new'\n    \
             replace: a new snippet\n"
        ),
        "the two keys the payload named, and no line for any of the four it omitted"
    );

    // And the identity the creation minted resolves, across the dispatcher, to
    // the snippet that was created.
    let found = invoke(&webview, "get_match", json!({ "id": created["moved"] }))
        .expect("the answered identity resolves");
    assert_eq!(found["trigger"]["trigger"]["text"], ":new");

    // A missing half of the snippet is refused at the boundary rather than
    // written as a trigger with no body, and so are the pre-3-4 flat shape and
    // an empty `triggers` list.
    let refreshed =
        invoke(&webview, "get_document", json!({ "id": document_id })).expect("the document reads");
    for refused in [
        json!({ "trigger": { "Single": ":half" } }),
        json!({ "trigger": ":flat", "replace": "the pre-3-4 shape" }),
        json!({ "trigger": { "Multiple": [] }, "content": { "Replace": "x" } }),
    ] {
        invoke(
            &webview,
            "create_match",
            json!({
                "document": document_id,
                "newMatch": refused,
                "position": { "Front": {} },
                "baseRevision": refreshed["revision"],
                "acknowledgement": { "accepted": [] },
            }),
        )
        .expect_err("not a snippet this application creates");
    } // End of the loop over the payloads refused at the boundary

    // Then the deletion, which answers with no identity at all.
    let deleted = invoke(
        &webview,
        "delete_match",
        json!({
            "id": refreshed["matches"][1]["id"],
            "baseRevision": refreshed["revision"],
            "acknowledgement": { "accepted": [] },
        }),
    )
    .expect("the deletion is legal");
    assert_eq!(deleted["outcome"], "saved");
    assert_eq!(deleted["committed"], true);
    assert!(
        deleted.get("moved").is_some(),
        "the key must be present, not omitted: {deleted}"
    );
    assert!(
        deleted["moved"].is_null(),
        "a deleted snippet has no identity in the new revision: {deleted}"
    );
    let text = invoke(&webview, "document_text", json!({ "id": document_id }))
        .expect("the document's bytes read");
    assert_eq!(
        text.as_str(),
        Some("matches:\n  - trigger: ':one'\n    replace: first\n")
    );
} // End of function create_and_delete_match_are_reachable_and_their_arguments_deserialize()

/// The fifth command that writes is reachable, and the text it is handed reaches
/// the disk byte for byte.
///
/// **The measurement Phase 2b-2c-3b owes**, and it is four claims a direct call
/// to [`crate::commands::WorkspaceSession::save_raw_document`] cannot make.
///
/// 1. **It is registered and a capability set naming no application command
///    does not block it.**
/// 2. **A whole document's text deserializes off the wire as a bare JSON
///    string** — the *inbound* half of the question
///    `document_text_answers_every_synthetic_fixture_byte_for_byte` asks
///    outbound. This is the first command whose **argument** is a file's own
///    text, so the crossing has a direction nothing had measured: the sample
///    carries a leading BOM, a CRLF pair, a decomposed `é`, an astral character
///    and a final line with no newline after it, and what is compared is
///    [`std::fs::read`] of the file afterwards.
///
///    **The bytes are read from the disk rather than asked for over the wire**,
///    which is the 2b-2c-3b review's third finding. `document_text` may serve
///    this session's cached text, so a version of this test that called it would
///    have passed for a command that updated the cache without persisting
///    anything — the one failure a claim about "the disk" exists to exclude. The
///    temporary directory is bound for exactly that reason.
/// 3. **`moved` is `null`** — over the dispatcher, where the field is written
///    rather than omitted. A replacement has no single match to name, and this is
///    the answer that says so rather than a caller inferring it.
/// 4. **An unparseable candidate crosses as `refused` in the `Ok` channel**,
///    carrying `DocumentDoesNotParse`, and handing that exact finding back
///    **commits it**. That is the owner's ruling as a wire fact: the application
///    neither refuses a broken file's repair nor writes it silently.
#[test]
fn save_raw_document_is_reachable_and_its_text_reaches_the_disk_unchanged() {
    let OverIpc {
        webview,
        document_id,
        view,
        _app,
        _dir: dir,
    } = opened_over_ipc("matches:\n  - trigger: ':one'\n    replace: first\n");
    // The file every assertion below reads with `std::fs::read`, named once.
    let target = dir.path().join("match").join("base.yml");

    // Written as escapes so that no editor can normalise this source file into
    // agreement with itself, exactly as the `document_text` sweep's sample is.
    let candidate = "\u{feff}matches:\r\n  - trigger: ':caf\u{65}\u{301}'\n    replace: \u{1f600}";
    let saved = invoke(
        &webview,
        "save_raw_document",
        json!({
            "document": document_id,
            "baseRevision": view["revision"],
            "text": candidate,
            "acknowledgement": { "accepted": [] },
        }),
    )
    .expect("the replacement is legal");
    assert_eq!(
        saved["outcome"], "saved",
        "the outcome must be a flat discriminant, not a tag: {saved}"
    );
    assert_eq!(saved["committed"], true);
    assert_eq!(saved["backup_taken"], true);
    assert_eq!(
        saved["notes"],
        json!([]),
        "a replacement re-encodes nothing, so it has nothing to disclose: {saved}"
    );
    assert!(
        saved.get("moved").is_some(),
        "the key must be present, not omitted: {saved}"
    );
    assert!(
        saved["moved"].is_null(),
        "a replacement has no single match to name: {saved}"
    );

    // The bytes on the disk, read from the disk: the BOM, the one CRLF pair, the
    // decomposition and the missing final newline all survived the crossing.
    // `document_text` is deliberately not what is asked — it may serve this
    // session's cached text, and a cache is not a file.
    assert_eq!(
        fs::read(&target).expect("the file is readable"),
        candidate.as_bytes(),
        "the submitted text must be committed exactly as submitted"
    );

    // Then the owner's ruling, over the wire. A text the parser rejects is
    // refused first, with a finding to show, and committed when that exact
    // finding comes back.
    let refreshed =
        invoke(&webview, "get_document", json!({ "id": document_id })).expect("the document reads");
    let broken = "matches: broken: here\n";
    let request = json!({
        "document": document_id,
        "baseRevision": refreshed["revision"],
        "text": broken,
        "acknowledgement": { "accepted": [] },
    });
    let refusal =
        invoke(&webview, "save_raw_document", request.clone()).expect("a refusal is a value");
    assert_eq!(refusal["outcome"], "refused");
    let findings = refusal["findings"]
        .as_array()
        .expect("a refusal carries its evidence")
        .clone();
    assert_eq!(findings.len(), 1);
    assert!(
        findings[0]["code"]["DocumentDoesNotParse"].is_object(),
        "the finding must be the one the owner's ruling is about: {refusal}"
    );
    assert_eq!(
        fs::read(&target).expect("the file is readable"),
        candidate.as_bytes(),
        "a refused replacement writes nothing"
    );
    assert!(!request.to_string().contains("force"));

    let acknowledged = invoke(
        &webview,
        "save_raw_document",
        json!({
            "document": document_id,
            "baseRevision": refreshed["revision"],
            "text": broken,
            "acknowledgement": { "accepted": findings },
        }),
    )
    .expect("the acknowledged replacement proceeds");
    assert_eq!(acknowledged["outcome"], "saved");
    assert_eq!(acknowledged["committed"], true);
    assert_eq!(
        fs::read(&target).expect("the file is readable"),
        broken.as_bytes(),
        "the acknowledged text is what reaches the disk"
    );
} // End of function save_raw_document_is_reachable_and_its_text_reaches_the_disk_unchanged()

/// The sixth command that writes is reachable, and its whole ordinary path —
/// refuse, acknowledge, commit — crosses the dispatcher.
///
/// **The measurement Phase 2c-3c-2 owes**, and it is four claims a direct call
/// to [`crate::commands::WorkspaceSession::duplicate_match`] cannot make.
///
/// 1. **It is registered and a capability set naming no application command
///    does not block it.**
/// 2. **Its arguments deserialize from the shapes the frontend really sends** —
///    a whole `MatchId` for `id`, a camelCase `baseRevision`, and an
///    `Acknowledgement` through its hand-written `Deserialize`. There is no
///    destination argument at all, which is the consult's Q4 as a wire fact.
/// 3. **The refusal crosses in the `Ok` channel carrying
///    `DuplicateKeepsTriggerDefinition` with its `revision` operand**, and the
///    same request with exactly those findings acknowledged commits — the
///    content-addressed round trip, for the one finding whose operand exists so
///    consent for one clone cannot be spent on another.
/// 4. **`moved` names the clone**, resolves through `get_match` across the
///    dispatcher — and the disk claim is read **from the disk**, with
///    `std::fs::read`, while `document_text` pins the separate boundary fact
///    that the session serves the same bytes. The two oracles are deliberately
///    both here: `document_text` serves the session's cache and refreshes
///    nothing for a loaded entry, so a version of this test that asked it alone
///    would have passed for a command that updated the cache without persisting
///    anything — the same cache-as-disk conflation the 2b-2c-3b review found in
///    `save_raw_document`'s test, and the 2c-3c-2 review found again here.
#[test]
fn duplicate_match_is_reachable_and_round_trips_its_own_finding() {
    let OverIpc {
        webview,
        document_id,
        view,
        _app,
        _dir: dir,
    } = opened_over_ipc(
        "matches:\n  - trigger: ':one'\n    replace: first\n  - trigger: ':two'\n    replace: second\n",
    );
    // The file every disk assertion below reads with `std::fs::read`, named
    // once: a claim about "the disk" must not be answered from a session cache.
    let target = dir.path().join("match").join("base.yml");
    let held = view["matches"][0]["id"].clone();

    let request = json!({
        "id": held,
        "baseRevision": view["revision"],
        "acknowledgement": { "accepted": [] },
    });
    let refusal =
        invoke(&webview, "duplicate_match", request.clone()).expect("a refusal is a value");
    assert_eq!(refusal["outcome"], "refused");
    assert_eq!(refusal["verdict"], "RefusedForUnacknowledgedSuspicions");
    let findings = refusal["findings"]
        .as_array()
        .expect("a refusal carries its evidence")
        .clone();
    assert_eq!(findings.len(), 1);
    let operand = &findings[0]["code"]["DuplicateKeepsTriggerDefinition"];
    assert!(
        operand.is_object(),
        "the finding must be the duplicate's own suspicion: {refusal}"
    );
    assert_eq!(
        operand["revision"].as_str().map(str::len),
        Some(64),
        "the finding is content-addressed to the candidate by its revision: {refusal}"
    );
    assert_ne!(
        operand["revision"], view["revision"],
        "the operand is the candidate's hash, not the base the request named"
    );
    assert!(!request.to_string().contains("force"));

    // The round trip: the findings go back exactly as they arrived, and the
    // same duplicate proceeds.
    let acknowledged = invoke(
        &webview,
        "duplicate_match",
        json!({
            "id": held,
            "baseRevision": view["revision"],
            "acknowledgement": { "accepted": findings },
        }),
    )
    .expect("the acknowledged duplicate proceeds");
    assert_eq!(
        acknowledged["outcome"], "saved",
        "the outcome must be a flat discriminant, not a tag: {acknowledged}"
    );
    assert_eq!(acknowledged["committed"], true);
    assert_eq!(acknowledged["backup_taken"], true);
    assert_eq!(acknowledged["notes"], json!([]));
    assert!(
        acknowledged["moved"].is_object(),
        "a committed duplicate names the clone: {acknowledged}"
    );
    assert_ne!(acknowledged["revision"], view["revision"]);

    // The identity the command minted resolves, across the dispatcher, to the
    // clone — and the one held before the save does not.
    let found = invoke(
        &webview,
        "get_match",
        json!({ "id": acknowledged["moved"] }),
    )
    .expect("the answered identity resolves");
    assert_eq!(found["trigger"]["trigger"]["text"], ":one");
    assert_eq!(
        found["path"]["segments"],
        json!([{ "Key": "matches" }, { "Index": 1 }]),
        "moved must name the clone at the post-insertion path: {found}"
    );
    let stale = invoke(&webview, "get_match", json!({ "id": held }))
        .expect_err("an identity from the previous revision must not resolve");
    assert_eq!(
        stale.get("code").and_then(Value::as_str),
        Some("identityStaleRevision"),
        "the refusal must be our typed code: {stale}"
    );

    // And the file really grew by one byte-exact copy — **read from the disk**,
    // because `document_text` serves the session's cache and a cache is not a
    // file (this test's own doc comment says which review found that
    // conflation, twice).
    let expected = "matches:\n  - trigger: ':one'\n    replace: first\n  - trigger: ':one'\n    \
                    replace: first\n  - trigger: ':two'\n    replace: second\n";
    assert_eq!(
        fs::read(&target).expect("the file is readable"),
        expected.as_bytes(),
        "the clone must be persisted, not only cached"
    );
    // The separate boundary fact: the session serves the same bytes over IPC,
    // so a later `get_document` and this text describe one file.
    let text = invoke(&webview, "document_text", json!({ "id": document_id }))
        .expect("the document's bytes read");
    assert_eq!(
        text.as_str(),
        Some(expected),
        "the session's cache must agree with the disk it just wrote"
    );
} // End of function duplicate_match_is_reachable_and_round_trips_its_own_finding()

/// Phase 3-7's pair is reachable, its arguments deserialize from the shapes the
/// frontend sends, and the saved range reaches the disk byte for byte.
///
/// Four claims a direct call cannot make: both commands are registered and
/// unblocked by a capability set naming no application command; `id`,
/// `baseRevision`, `text` and `acknowledgement` deserialize from camelCase JSON;
/// the read's answer crosses as `{ text, first_line, line_count }` and its
/// refusal as `itemTextRefused` carrying the core's `EditError` whole; and the
/// committed file is read **from the disk**, while `document_text` pins that the
/// session serves the same bytes.
#[test]
fn the_local_raw_item_pair_is_reachable_and_its_text_reaches_the_disk() {
    let source = "matches:\n  # about one\n  - trigger: ':one'\n    replace: first\n  \
                  - trigger: ':two'\n    replace: second\n";
    let OverIpc {
        webview,
        document_id,
        view,
        _app,
        _dir: dir,
    } = opened_over_ipc(source);
    let target = dir.path().join("match").join("base.yml");
    let held = view["matches"][0]["id"].clone();

    let read = invoke(&webview, "match_item_text", json!({ "id": held })).expect("the range reads");
    assert_eq!(
        read,
        json!({
            "text": "  # about one\n  - trigger: ':one'\n    replace: first\n",
            "first_line": 2,
            "line_count": 3,
        })
    );

    let text = "  # about one, rewritten\n  - trigger: ':one'\n    replace: changed\n";
    let saved = invoke(
        &webview,
        "save_match_item_text",
        json!({
            "id": held,
            "baseRevision": view["revision"],
            "text": text,
            "acknowledgement": { "accepted": [] },
        }),
    )
    .expect("the save commits");
    assert_eq!(saved["outcome"], "saved", "{saved}");
    assert_eq!(saved["committed"], true);
    assert!(
        saved["moved"].is_object(),
        "the edited match is named: {saved}"
    );
    let expected =
        "matches:\n  # about one, rewritten\n  - trigger: ':one'\n    replace: changed\n  \
                    - trigger: ':two'\n    replace: second\n";
    assert_eq!(
        fs::read(&target).expect("the file is readable"),
        expected.as_bytes(),
        "the range must be persisted, not only cached"
    );
    let served = invoke(&webview, "document_text", json!({ "id": document_id }))
        .expect("the document's bytes read");
    assert_eq!(served.as_str(), Some(expected));

    // The identity held before the save is stale for the read too.
    let stale = invoke(&webview, "match_item_text", json!({ "id": held }))
        .expect_err("a stale identity must not read");
    assert_eq!(
        stale.get("code").and_then(Value::as_str),
        Some("identityStaleRevision"),
        "{stale}"
    );

    // A refused range crosses as `itemTextRefused`, carrying the core's code.
    let holed = "matches:\n  - trigger: ':one'\n    vars:\n      first: 'one'\n      \
                 # a note the file owns\n\n      second: 'two'\n    replace: x\n";
    let OverIpc {
        webview,
        view,
        _app,
        _dir: _holed_dir,
        ..
    } = opened_over_ipc(holed);
    let refused = invoke(
        &webview,
        "match_item_text",
        json!({ "id": view["matches"][0]["id"] }),
    )
    .expect_err("a holed range is refused");
    assert_eq!(refused["code"], "itemTextRefused", "{refused}");
    assert!(
        refused["error"]["ItemRangeNotContiguous"].is_object(),
        "the core's refusal travels whole: {refused}"
    );
} // End of function the_local_raw_item_pair_is_reachable_and_its_text_reaches_the_disk()

/// Phase 3-10's bulk option edit is reachable, its request deserializes from the
/// JSON the frontend sends, and its answer accounts for the file — through the
/// real dispatcher, with no `force` property anywhere in the request.
#[test]
fn the_bulk_option_edit_is_reachable_and_accounts_for_each_file() {
    let source = "matches:\n  - trigger: ':one'\n    replace: first\n  \
                  - trigger: ':two'\n    replace: second\n";
    let OverIpc {
        webview,
        document_id,
        view,
        _app,
        _dir: dir,
    } = opened_over_ipc(source);
    let target = dir.path().join("match").join("base.yml");
    let request = json!({
        "changes": [
            { "option": "word", "value": { "Set": "true" } },
            { "option": "force_mode", "value": { "Set": "clipboard" } },
        ],
        "files": [{
            "document": document_id,
            "base_revision": view["revision"],
            "matches": [view["matches"][0]["id"], view["matches"][1]["id"]],
            "consent": null,
        }],
        "excluded": [],
    });
    assert!(!request.to_string().contains("force\""));
    let result = invoke(
        &webview,
        "apply_bulk_options",
        json!({ "request": request }),
    )
    .expect("the bulk edit answers");
    assert_eq!(result["preflight_passed"], true, "{result}");
    assert_eq!(result["nothing_written"], false);
    assert_eq!(result["files"][0]["document"], document_id);
    assert_eq!(result["files"][0]["outcome"], "saved");
    assert_eq!(result["files"][0]["backup_taken"], true);
    assert_eq!(
        fs::read_to_string(&target).expect("the file reads back"),
        "matches:\n  - trigger: ':one'\n    replace: first\n    word: true\n    force_mode: clipboard\n  \
         - trigger: ':two'\n    replace: second\n    word: true\n    force_mode: clipboard\n"
    );

    let refused = invoke(
        &webview,
        "apply_bulk_options",
        json!({ "request": { "changes": [], "files": [], "excluded": [] } }),
    )
    .expect_err("a malformed request is refused");
    assert_eq!(refused["code"], "bulkRefused");
    assert_eq!(refused["error"], json!({ "NoOptionChanges": {} }));
} // End of function the_bulk_option_edit_is_reachable_and_accounts_for_each_file()

/// A save refused by the semantic gate crosses in the **`Ok`** channel.
///
/// The distinction the whole result type is built on, measured at the boundary:
/// a refusal is an outcome the caller acts on, not a rejection. If it were an
/// `Err`, `invoke` would reject and `classifyFailure` would file it under a code
/// with no findings attached, which is exactly the shape that would make the
/// acknowledgement round trip impossible to build.
#[test]
fn a_refused_save_crosses_as_a_value_and_carries_its_findings() {
    let OverIpc {
        webview,
        document_id: _document_id,
        view,
        _app,
        _dir,
    } = opened_over_ipc(
        "matches:\n  - trigger: ':one'\n    replace: first\n  - trigger: ':two'\n    replace: 'hello {{who}}'\n",
    );

    let request = json!({
        "id": view["matches"][1]["id"],
        "after": Value::Null,
        "baseRevision": view["revision"],
        "acknowledgement": { "accepted": [] },
    });
    let refusal = invoke(&webview, "move_match", request.clone()).expect("a refusal is a value");
    assert_eq!(refusal["outcome"], "refused");
    assert_eq!(refusal["verdict"], "RefusedForUnacknowledgedSuspicions");
    let findings = refusal["findings"]
        .as_array()
        .expect("a refusal carries its evidence")
        .clone();
    assert_eq!(findings.len(), 1);

    // The round trip: the findings go back exactly as they arrived, and the same
    // move proceeds. Nothing anywhere in either request is a flag.
    assert!(!request.to_string().contains("force"));
    let acknowledged = invoke(
        &webview,
        "move_match",
        json!({
            "id": view["matches"][1]["id"],
            "after": Value::Null,
            "baseRevision": view["revision"],
            "acknowledgement": { "accepted": findings },
        }),
    )
    .expect("the acknowledged move proceeds");
    assert_eq!(acknowledged["outcome"], "saved");
} // End of function a_refused_save_crosses_as_a_value_and_carries_its_findings()

/// The directory holding the committed, hand-authored corpus.
///
/// The **synthetic** corpus only. `crates/espansoconfig-core/tests/corpus/real/`
/// is the owner's private configuration and no test in this repository reads it
/// (CLAUDE.md section 1).
fn synthetic_corpus() -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("crates")
        .join("espansoconfig-core")
        .join("tests")
        .join("corpus")
        .join("synthetic")
}

/// The fifteen fixtures whose whitespace and encoding *are* the test data.
///
/// `CLAUDE.md` section 4's table, transcribed so that a fixture renamed or
/// deleted fails here as well as in `tests/corpus_integrity.rs`. Listing them by
/// name rather than sweeping the directory alone is what makes the sweep below
/// able to say *these* files crossed intact, not merely *some* files did.
const BYTE_EXACT_FIXTURES: [&str; 15] = [
    "crlf-line-endings.yml",
    "bom-utf8.yml",
    "no-trailing-newline.yml",
    "unicode-offsets.yml",
    "block-scalars.yml",
    "block-scalar-terminal-spaces.yml",
    "block-scalar-leading-blank-lines.yml",
    "folded-more-indented.yml",
    "block-scalar-header-tails.yml",
    "file-comments-and-mixed-endings.yml",
    "single-line-no-line-ending.yml",
    "run-based-removal-boundaries.yml",
    "move-block-scalar-seams.yml",
    "move-run-joins.yml",
    "move-kept-comment-joins-a-block.yml",
];

/// Builds a workspace whose `match/` directory is the whole synthetic corpus.
///
/// `fs::copy` moves bytes, so every fixture arrives with the CRLF pairs, BOM,
/// missing final newline and trailing spaces it was committed with. Returns the
/// directory and the file names copied into it, sorted.
fn corpus_workspace() -> (TempDir, Vec<String>) {
    let dir = TempDir::new().expect("temp dir");
    let root = dir.path();
    fs::create_dir_all(root.join("config")).unwrap();
    fs::create_dir_all(root.join("match")).unwrap();
    fs::write(root.join("config").join("default.yml"), "backend: auto\n").unwrap();

    let corpus = synthetic_corpus();
    let mut copied = Vec::new();
    let entries = fs::read_dir(&corpus)
        .unwrap_or_else(|error| panic!("cannot read {}: {error}", corpus.display()));
    for entry in entries {
        let path = entry.expect("a corpus directory entry").path();
        let is_yaml = path.extension().and_then(|ext| ext.to_str()) == Some("yml");
        if !path.is_file() || !is_yaml {
            continue;
        }
        let name = path
            .file_name()
            .expect("a file has a name")
            .to_string_lossy()
            .into_owned();
        fs::copy(&path, root.join("match").join(&name))
            .unwrap_or_else(|error| panic!("cannot copy {name}: {error}"));
        copied.push(name);
    } // End of the loop over the synthetic corpus directory
    copied.sort();
    (dir, copied)
} // End of function corpus_workspace()

/// The offset of the first byte at which two slices differ, or `None`.
///
/// Reported instead of an `assert_eq!` on the two slices: a mismatch anywhere in
/// a 2 kB fixture would otherwise print both files, and an offset plus two
/// lengths says everything a reader needs without the noise.
fn first_difference(left: &[u8], right: &[u8]) -> Option<usize> {
    let common = left.len().min(right.len());
    for offset in 0..common {
        if left[offset] != right[offset] {
            return Some(offset);
        }
    }
    (left.len() != right.len()).then_some(common)
} // End of function first_difference()

/// `document_text` answers every synthetic fixture byte for byte.
///
/// The whole committed corpus is copied into a workspace and asked for over IPC,
/// and each answer is compared against `std::fs::read` of the file that was
/// copied. That comparison covers the whole path a document takes to the
/// webview: the read, the cache, the command, `serde`'s encoding of a `String`
/// into the response body, and the decoding of that body back into a value.
///
/// The fifteen fixtures of `CLAUDE.md` section 4 are asserted present, so a
/// renamed one cannot quietly leave the sweep, and the five properties they
/// exist for are asserted **on what came back** rather than on the file — which
/// is the half that could fail if something on this path normalised anything.
#[test]
fn document_text_answers_every_synthetic_fixture_byte_for_byte() {
    let (dir, copied) = corpus_workspace();
    for fixture in BYTE_EXACT_FIXTURES {
        assert!(
            copied.iter().any(|name| name == fixture),
            "{fixture} is named in CLAUDE.md section 4 and is not in the synthetic corpus"
        );
    }

    let app = mock_app();
    let webview = main_window(&app);
    invoke(
        &webview,
        "open_workspace",
        json!({ "root": dir.path().to_string_lossy() }),
    )
    .expect("the corpus workspace opens");
    let documents = invoke(&webview, "list_documents", json!({})).expect("the workspace is open");

    let mut checked = 0usize;
    let mut bytes_compared = 0usize;
    for row in documents.as_array().expect("a list of summaries") {
        let relative = row["relative_path"].as_str().unwrap_or_default();
        let Some(name) = relative.strip_prefix("match/") else {
            continue;
        };
        let answer = invoke(
            &webview,
            "document_text",
            json!({ "id": row["id"].clone() }),
        )
        .unwrap_or_else(|error| panic!("{name}: document_text refused: {error}"));
        let text = answer
            .as_str()
            .unwrap_or_else(|| panic!("{name}: document_text must answer a JSON string"));
        let on_disk = fs::read(dir.path().join("match").join(name)).expect("the copy is readable");
        if let Some(offset) = first_difference(text.as_bytes(), &on_disk) {
            panic!(
                "{name}: the answer differs from the file at byte {offset} \
                 ({} bytes answered, {} bytes on disk)",
                text.len(),
                on_disk.len()
            );
        }
        bytes_compared += on_disk.len();
        checked += 1;
    } // End of the loop over the copied corpus

    assert_eq!(
        checked,
        copied.len(),
        "every copied fixture must have been asked for"
    );
    println!("document_text: {checked} fixtures, {bytes_compared} bytes, all identical");

    // The five properties the byte-exact fixtures exist for, re-asserted on what
    // crossed the boundary. A comparison against the file could in principle
    // pass while both sides were wrong — if the *copy* had been normalised, say
    // — and these cannot.
    let answer = |name: &str| -> String {
        let row = documents
            .as_array()
            .expect("a list")
            .iter()
            .find(|row| row["relative_path"].as_str() == Some(&format!("match/{name}")))
            .unwrap_or_else(|| panic!("{name} is not listed"));
        invoke(
            &webview,
            "document_text",
            json!({ "id": row["id"].clone() }),
        )
        .unwrap_or_else(|error| panic!("{name}: {error}"))
        .as_str()
        .expect("a JSON string")
        .to_owned()
    };

    let crlf = answer("crlf-line-endings.yml");
    let pairs = crlf.matches("\r\n").count();
    assert!(
        pairs > 5,
        "the CRLF fixture crossed with {pairs} CRLF pairs"
    );
    assert_eq!(
        pairs,
        crlf.matches('\n').count(),
        "a bare LF arrived, so a line ending was converted on the way"
    );

    let bom = answer("bom-utf8.yml");
    assert!(
        bom.starts_with('\u{feff}'),
        "the leading UTF-8 BOM was stripped in transit"
    );

    assert!(
        !answer("no-trailing-newline.yml").ends_with('\n'),
        "a final newline was added in transit"
    );

    // Written as escapes so that no editor can normalise this source file into
    // agreeing with a normalising boundary.
    let unicode = answer("unicode-offsets.yml");
    assert!(
        unicode.contains('\u{e9}'),
        "the precomposed e-acute did not survive"
    );
    assert!(
        unicode.contains("\u{65}\u{301}"),
        "the decomposed e-acute was composed in transit"
    );
    assert!(
        unicode.contains('\u{1f600}'),
        "the astral character did not survive"
    );

    let spaces = answer("block-scalar-terminal-spaces.yml");
    assert!(
        spaces.ends_with("  ") && !spaces.ends_with('\n'),
        "the block scalar's two terminal spaces were trimmed in transit"
    );
} // End of function document_text_answers_every_synthetic_fixture_byte_for_byte()

/// A document that does not parse still has bytes, and they still cross.
///
/// The case the raw text surface exists for: the file a reader most needs to see
/// is the one the parser refused. `get_document` answers a view with
/// `parsed: false`, and `document_text` must answer the file rather than
/// inheriting that refusal.
#[test]
fn document_text_answers_a_file_that_does_not_parse() {
    let dir = TempDir::new().expect("temp dir");
    fs::create_dir_all(dir.path().join("match")).unwrap();
    let broken = "matches:\n  - trigger: ':unclosed\n";
    fs::write(dir.path().join("match").join("broken.yml"), broken).unwrap();
    let app = mock_app();
    let webview = main_window(&app);
    invoke(
        &webview,
        "open_workspace",
        json!({ "root": dir.path().to_string_lossy() }),
    )
    .expect("the tree opens");
    let documents = invoke(&webview, "list_documents", json!({})).expect("the workspace is open");
    let id = documents.as_array().expect("a list")[0]["id"].clone();

    let view =
        invoke(&webview, "get_document", json!({ "id": id.clone() })).expect("the file reads");
    assert_eq!(
        view["parsed"], false,
        "this fixture must not parse, or the test proves nothing"
    );
    let text = invoke(&webview, "document_text", json!({ "id": id })).expect("the bytes read");
    assert_eq!(text.as_str(), Some(broken));
} // End of function document_text_answers_a_file_that_does_not_parse()

/// An unknown identity is refused with a code rather than an empty string.
///
/// The failure arm of the newest command, because "answers the file" needs the
/// other side: a command that answered `""` for a document it does not hold
/// would look, on a screen, exactly like an empty file.
#[test]
fn document_text_refuses_an_unknown_document_with_a_code() {
    let dir = synthetic_tree();
    let app = mock_app();
    let webview = main_window(&app);
    invoke(
        &webview,
        "open_workspace",
        json!({ "root": dir.path().to_string_lossy() }),
    )
    .expect("the synthetic tree opens");
    let error = invoke(&webview, "document_text", json!({ "id": 9_999_999 }))
        .expect_err("no such document");
    assert_eq!(
        error.get("code").and_then(Value::as_str),
        Some("unknownDocument"),
        "a missing document must be a code, never an empty file: {error}"
    );
} // End of function document_text_refuses_an_unknown_document_with_a_code()

/// Every `UnknownEntry` object anywhere in a `get_document` response.
///
/// Found **by shape** — an object carrying both `value_span` and `value_text` —
/// rather than by walking `matches[i].unknown_entries[j]` by name, so that the
/// search does not depend on the field layout it is checking. An unknown entry
/// never contains another (the projection does not descend into an unmodelled
/// value), so nothing is counted twice.
fn unknown_entries_in(value: &Value, out: &mut Vec<Value>) {
    match value {
        Value::Object(map) => {
            if map.contains_key("value_span") && map.contains_key("value_text") {
                out.push(value.clone());
            }
            for nested in map.values() {
                unknown_entries_in(nested, out);
            }
        }
        Value::Array(items) => {
            for item in items {
                unknown_entries_in(item, out);
            }
        }
        _ => {}
    } // End of the match over the response's JSON shape
} // End of function unknown_entries_in()

/// A file whose unmodelled values carry the bytes a boundary would change.
///
/// Hand-authored and neutral (CLAUDE.md section 1). Four unrecognised keys — one
/// at the top level, three inside matches — so that the sweep below reaches both
/// places the projection records them. The characters are `\u{…}` escapes so
/// that no editor can normalise this source file into agreeing with a
/// normalising boundary.
///
/// **A NUL is deliberately absent, and that was measured rather than assumed.**
/// This document has to *parse* or it produces no unmodelled entry at all, and
/// adding a U+0000 to one of the quoted values here made `parsed` come back
/// `false`. The 1c-2b-2b-1 review measured the shape that sentence used to
/// generalise to: in a *plain* value the parse succeeds and the parser simply
/// **stops** at the NUL, which leaves it and everything after it outside every
/// node span — so a NUL reaches no `value_text` either way
/// (`which_control_characters_can_reach_a_projected_slice` in
/// `crates/espansoconfig-core/tests/model_projection.rs`). U+2028 and U+2029 are
/// accepted and are therefore here. `document_text` needs no parse and carries all three
/// (`document_text_carries_a_nul_and_the_two_unicode_line_separators`), so the
/// gap is `value_text` and a NUL alone — `1c-2b-2a-notes.md` hole 9.
const UNMODELLED_HAZARDS: &str = concat!(
    "invented_at_the_top_level: \"caf\u{e9} cafe\u{301} \u{1f600}\"\n",
    "matches:\n",
    "  - trigger: ':one'\n",
    "    replace: first\n",
    "    invented_by_a_later_espanso: |\n",
    "      two real spaces end this line  \n",
    "      and this one ends with a CRLF pair\r\n",
    "  - trigger: ':two'\n",
    "    replace: second\n",
    "    another_key_this_build_does_not_know: \"caf\u{e9} \u{1f600}\"\n",
    "    a_third_key_from_a_later_espanso: \"ls\u{2028} ps\u{2029} end\"\n",
);

/// An unmodelled entry's `value_text` crosses the dispatcher byte for byte.
///
/// **The review of Phase 1c-2b-2a's first high finding, made falsifiable.** The
/// only fidelity test `value_text` had projected in-process and called
/// `serde_json::to_value`; it never built an app, never invoked `get_document`
/// and never decoded a Tauri response body. So a regression confined to
/// serializing a [`espansoconfig_core::model::DocumentView`] — dropping the
/// field, truncating it, normalising it — would have left the bare-string
/// `document_text` sweep, the model oracle and the mocked frontend tests all
/// green.
///
/// This asks for the document over the **real IPC dispatcher** and compares each
/// answered `value_text` against a Rust-side slice of the file's own bytes by
/// the `value_span` that arrived beside it. The oracle is therefore a different
/// expression from the one the projection evaluated, taken from a different
/// source: `std::fs::read` of the file on disk.
#[test]
fn an_unmodelled_entrys_value_text_crosses_the_dispatcher_byte_for_byte() {
    let dir = TempDir::new().expect("temp dir");
    fs::create_dir_all(dir.path().join("match")).unwrap();
    let path = dir.path().join("match").join("unmodelled.yml");
    fs::write(&path, UNMODELLED_HAZARDS).unwrap();
    let app = mock_app();
    let webview = main_window(&app);
    invoke(
        &webview,
        "open_workspace",
        json!({ "root": dir.path().to_string_lossy() }),
    )
    .expect("the tree opens");
    let documents = invoke(&webview, "list_documents", json!({})).expect("the workspace is open");
    let id = documents.as_array().expect("a list")[0]["id"].clone();

    let view = invoke(&webview, "get_document", json!({ "id": id })).expect("the file reads");
    assert_eq!(
        view["parsed"], true,
        "this fixture must parse, or it produces no unmodelled entry at all"
    );

    let mut entries = Vec::new();
    unknown_entries_in(&view, &mut entries);
    assert_eq!(
        entries.len(),
        4,
        "the fixture holds four unrecognised keys, and a dropped value_text \
         would leave none of them findable by shape"
    );

    let on_disk = fs::read(&path).expect("the file is readable");
    let mut carried = 0usize;
    for entry in &entries {
        let start = entry["value_span"]["start"]
            .as_u64()
            .expect("a span start is a number") as usize;
        let end = entry["value_span"]["end"]
            .as_u64()
            .expect("a span end is a number") as usize;
        let text = entry["value_text"]
            .as_str()
            .expect("a value text is a JSON string");
        let expected = on_disk
            .get(start..end)
            .unwrap_or_else(|| panic!("the answered span {start}..{end} is not in the file"));
        assert_eq!(
            text.as_bytes(),
            expected,
            "the value text is not the slice its span names (bytes {start}..{end})"
        );
        carried += text.len();
    } // End of the loop over the entries the dispatcher answered

    println!(
        "value_text over IPC: {} entries, {carried} bytes",
        entries.len()
    );

    // The hazards, named individually on what crossed, so that a failure says
    // which one was lost rather than only that something was.
    let all: String = entries
        .iter()
        .filter_map(|entry| entry["value_text"].as_str())
        .collect::<Vec<_>>()
        .join("\n");
    assert!(all.contains('\u{e9}'), "the precomposed e-acute was lost");
    assert!(
        all.contains("\u{65}\u{301}"),
        "the decomposed e-acute was composed in transit"
    );
    assert!(all.contains('\u{1f600}'), "the astral character was lost");
    assert!(
        all.contains("\r\n"),
        "a CRLF inside a block scalar was converted in transit"
    );
    assert!(
        all.contains("line  \n"),
        "a block scalar's two real trailing spaces were trimmed in transit"
    );
    assert!(
        all.contains('\u{2028}'),
        "the line separator U+2028 was lost in transit"
    );
    assert!(
        all.contains('\u{2029}'),
        "the paragraph separator U+2029 was lost in transit"
    );
} // End of function an_unmodelled_entrys_value_text_crosses_the_dispatcher_byte_for_byte()

/// A NUL and the two Unicode line separators cross the dispatcher unchanged.
///
/// **The review's first medium finding.** All three are valid UTF-8, valid
/// content for a Rust `String` and valid content for a JavaScript string, and
/// none of the fifteen byte-exact fixtures contains one — so the corpus sweep
/// above said nothing about them. They are where the encoders on this path have
/// opinions: `serde_json` writes NUL as a six-character escape, and leaves
/// U+2028 and U+2029 as raw bytes, which is legal JSON and was for years illegal
/// inside a JavaScript source string literal.
///
/// The source is **hand-written rather than a fixture**, which is an R20
/// deviation of the same shape as `1c-2b-2a-notes.md` hole 1 and is recorded
/// beside it as hole 9. Closing it means a sixteenth row in `CLAUDE.md`
/// section 4, and no existing fixture may be edited to hold these bytes.
///
/// The file deliberately does not have to parse: `document_text` answers a
/// document's bytes whether or not the substrate accepted them, which is the
/// property `document_text_answers_a_file_that_does_not_parse` pins.
#[test]
fn document_text_carries_a_nul_and_the_two_unicode_line_separators() {
    const CONTROLS: &str = concat!(
        "matches:\n",
        "  - trigger: ':controls'\n",
        "    replace: \"nul\u{0} ls\u{2028} ps\u{2029} end\"\n",
    );
    let dir = TempDir::new().expect("temp dir");
    fs::create_dir_all(dir.path().join("match")).unwrap();
    let path = dir.path().join("match").join("controls.yml");
    fs::write(&path, CONTROLS).unwrap();
    let app = mock_app();
    let webview = main_window(&app);
    invoke(
        &webview,
        "open_workspace",
        json!({ "root": dir.path().to_string_lossy() }),
    )
    .expect("the tree opens");
    let documents = invoke(&webview, "list_documents", json!({})).expect("the workspace is open");
    let id = documents.as_array().expect("a list")[0]["id"].clone();

    let answer = invoke(&webview, "document_text", json!({ "id": id })).expect("the bytes read");
    let text = answer
        .as_str()
        .expect("document_text answers a JSON string");
    let on_disk = fs::read(&path).expect("the file is readable");
    assert_eq!(
        text.as_bytes(),
        on_disk.as_slice(),
        "the answer must be the file, byte for byte"
    );

    // Named individually, on what came back rather than on the file.
    assert!(
        text.contains('\u{0}'),
        "the NUL was dropped, or something treated it as a terminator"
    );
    assert!(
        text.contains('\u{2028}'),
        "the line separator U+2028 was lost"
    );
    assert!(
        text.contains('\u{2029}'),
        "the paragraph separator U+2029 was lost"
    );
    assert!(
        text.ends_with("end\"\n"),
        "the text was cut short at one of the three"
    );
} // End of function document_text_carries_a_nul_and_the_two_unicode_line_separators()

/// A conflict's `disk_text` crosses the dispatcher byte for byte, and the digest
/// beside it is re-derived from what came out.
///
/// **The Phase 2c-4a-1 review's medium finding, made falsifiable.** Three tests
/// claimed byte-exactness for this field and none of them could have falsified a
/// normalisation in the serialization path: the Rust test in `crate::commands`
/// inspects the value *before* it is serialized, `crate::save`'s shape test does
/// serialize but only over ordinary LF text, and `saveOutcome.test.ts` starts
/// from a hand-built TypeScript value that never crossed anything. A regression
/// confined to the `Conflict` arm of [`crate::save::SaveResult`]'s hand-written
/// [`serde::Serialize`] — stripping the BOM, converting the line endings,
/// truncating the string — would have left all three green.
///
/// The claim is therefore asked the way the other two fidelity sweeps in this
/// module ask theirs: over the **real dispatcher**, with the answer's `disk_text`
/// compared against `std::fs::read` of the file the other writer wrote, and the
/// digest recomputed **here**, from the bytes the response body carried, rather
/// than restated from the expression that produced them. A payload whose text was
/// normalised on the way out fails the first comparison; one whose revision was
/// taken from a different read fails the second.
///
/// The fixture is hand-authored and neutral (CLAUDE.md section 1), written with
/// `\u{feff}` and explicit `\r\n` escapes so that an editor saving this source
/// file cannot quietly make it agree with a normalising boundary.
#[test]
fn a_conflicts_disk_text_crosses_the_dispatcher_byte_for_byte() {
    let OverIpc {
        webview,
        document_id,
        view,
        _app,
        _dir: dir,
    } = opened_over_ipc("matches:\n  - trigger: ':mine'\n    replace: mine\n");
    // The file every disk assertion below reads with `std::fs::read`: a claim
    // about the bytes must not be answered from this session's cache.
    let target = dir.path().join("match").join("base.yml");

    // Another writer replaces the file with one carrying all three distinguishing
    // properties — a UTF-8 BOM, CRLF line endings and no final newline — and this
    // session is not told, so the save below is refused against a stale base.
    let theirs = "\u{feff}# theirs\r\nmatches:\r\n  - trigger: ':theirs'\r\n    replace: theirs";
    fs::write(&target, theirs).unwrap();

    let answer = invoke(
        &webview,
        "save_raw_document",
        json!({
            "document": document_id,
            "baseRevision": view["revision"],
            "text": "matches:\n  - trigger: ':stale'\n    replace: stale\n",
            "acknowledgement": { "accepted": [] },
        }),
    )
    .expect("a conflict is a value in the Ok channel, not a rejection");
    assert_eq!(
        answer["outcome"], "conflict",
        "the premise: a stale base must come back as a conflict: {answer}"
    );
    assert_eq!(
        answer["expected"], view["revision"],
        "the conflict must be about the base this request named: {answer}"
    );
    assert_ne!(
        answer["disk_revision"], view["revision"],
        "the fixture must exercise a file that really moved, or this proves nothing"
    );

    // 1. The bytes, against a different expression from the one the payload was
    //    built out of: the file itself, read from the disk.
    let crossed = answer["disk_text"]
        .as_str()
        .expect("disk_text crosses as a JSON string");
    let on_disk = fs::read(&target).expect("the file is readable");
    if let Some(offset) = first_difference(crossed.as_bytes(), &on_disk) {
        panic!(
            "disk_text differs from the file at byte {offset} \
             ({} bytes crossed, {} bytes on disk)",
            crossed.len(),
            on_disk.len()
        );
    }
    assert_eq!(
        on_disk,
        theirs.as_bytes(),
        "a conflict must leave the other writer's bytes alone"
    );

    // The three properties named individually on **what crossed**, so that a
    // failure says which one this boundary lost rather than only that something
    // changed. The comparison above could in principle pass with both sides
    // wrong; these cannot.
    assert!(
        crossed.starts_with('\u{feff}'),
        "the leading UTF-8 BOM was stripped in transit"
    );
    assert_eq!(
        crossed.matches("\r\n").count(),
        3,
        "a CRLF pair was converted in transit"
    );
    assert_eq!(
        crossed.matches("\r\n").count(),
        crossed.matches('\n').count(),
        "a bare LF arrived, so a line ending was converted on the way"
    );
    assert!(
        !crossed.ends_with('\n'),
        "a final newline was added in transit"
    );

    // 2. The pairing, re-derived from the bytes that came out of serialization.
    //    The digest is computed on this side of the dispatcher, from the string
    //    the response body carried, so a text normalised anywhere on the way out
    //    no longer hashes to the revision that crossed beside it.
    assert_eq!(
        answer["disk_revision"].as_str(),
        Some(
            espansoconfig_core::ContentRevision::of_bytes(crossed.as_bytes())
                .to_hex()
                .as_str()
        ),
        "disk_text must hash to disk_revision: the pairing is the whole claim: {answer}"
    );
    // And the projection beside it describes the same read, which is what makes
    // the three operands one snapshot rather than three observations.
    assert_eq!(
        answer["disk"]["revision"], answer["disk_revision"],
        "the top-level revision must be the revision of the projection beside it: {answer}"
    );
} // End of function a_conflicts_disk_text_crosses_the_dispatcher_byte_for_byte()

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
/// permission.** It does not — the first two permissions, added at 2d-5-7a, are
/// the event plugin's and name no application command — and this test is why
/// rather than an assertion that it does not: the labels go to an
/// **application** command, which the dispatcher does not access-check from a
/// local origin, and Rust builds the menu itself. A frontend that built the
/// menu through `@tauri-apps/api/menu` would be calling `plugin:menu|…`, which
/// *is* access-checked, and would need `core:menu`'s permissions granted to the
/// renderer.
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
fn the_menu_command_is_registered_and_reachable_with_no_menu_permission() {
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
        "the capability set blocked set_menu_labels, so it needs a menu permission after all: {error}"
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
} // End of function the_menu_command_is_registered_and_reachable_with_no_menu_permission()

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

/// The capability grants exactly the two event-plugin permissions, to the local
/// context only — Phase 2d-5-7a.
///
/// Two readings of one fact, and both are needed. **The file, as written**: a
/// third entry, a wildcard, a `remote` block or a second capability file in the
/// directory fails here by name. **And what the entries resolve to**, asked of
/// the shipped context's own `RuntimeAuthority` — `tauri::Context` exposes the
/// same object the dispatcher consults — so that the grant is measured rather
/// than inferred from two identifiers. The second reading is where
/// `core:event:default` is ruled out: that set would also have resolved
/// `plugin:event|emit` and `plugin:event|emit_to`, and both resolve to nothing.
/// It is also where "to the local context only" is a measurement: every
/// resolved command carries `ExecutionContext::Local`, the remote origin
/// resolves neither, and a window that is not `main` resolves neither.
///
/// And the twenty application commands resolve to nothing from either
/// origin, which is the other half of what "names no application command"
/// means: a local origin reaches them because the dispatcher does not consult
/// this list for an application command, not because the list allows them, and
/// a remote origin is refused because nothing allows them.
#[test]
fn the_capability_grants_exactly_the_two_event_permissions() {
    // 1. The file.
    let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/capabilities");
    let mut files: Vec<String> = fs::read_dir(dir)
        .expect("the capabilities directory can be read")
        .map(|entry| {
            entry
                .expect("an entry")
                .file_name()
                .to_string_lossy()
                .into_owned()
        })
        .collect();
    files.sort();
    assert_eq!(
        files,
        ["default.json"],
        "one capability file, so no second one widens what this test reads"
    );
    let capability: Value = serde_json::from_str(
        &fs::read_to_string(format!("{dir}/default.json")).expect("the capability file reads"),
    )
    .expect("the capability file is JSON");
    assert_eq!(capability["identifier"], "default");
    assert_eq!(capability["windows"], json!(["main"]));
    assert_eq!(
        capability["permissions"],
        json!(["core:event:allow-listen", "core:event:allow-unlisten"]),
        "exactly the two entries the listener needs, in the order the file lists them"
    );
    assert!(
        capability.get("remote").is_none(),
        "no remote block: nothing grants a foreign origin anything"
    );
    assert!(
        capability.get("webviews").is_none(),
        "the grant is by window label, not by webview label"
    );

    // 2. What the entries resolve to, through the same context `main()` builds.
    let mut context = crate::context::<MockRuntime>();
    let authority = context.runtime_authority_mut();
    let local = Origin::Local;
    let remote = Origin::Remote {
        url: REMOTE_ORIGIN.parse::<Url>().expect("a URL"),
    };
    for command in [EVENT_LISTEN, EVENT_UNLISTEN] {
        let resolved = authority
            .resolve_access(command, "main", "main", &local)
            .unwrap_or_else(|| panic!("{command} must resolve for the local main webview"));
        assert!(
            !resolved.is_empty()
                && resolved
                    .iter()
                    .all(|cmd| matches!(cmd.context, ExecutionContext::Local)),
            "{command} must be granted in the local context only: {resolved:?}"
        );
        assert!(
            authority
                .resolve_access(command, "main", "main", &remote)
                .is_none(),
            "{command} must resolve to nothing for a remote origin"
        );
        assert!(
            authority
                .resolve_access(command, "other", "other", &local)
                .is_none(),
            "{command} is granted to the main window, not to any window"
        );
    } // End of the loop over the two granted plugin commands
    for command in ["plugin:event|emit", "plugin:event|emit_to"] {
        assert!(
            authority
                .resolve_access(command, "main", "main", &local)
                .is_none(),
            "{command} is what core:event:default would have granted, and must not be"
        );
    } // End of the loop over the two plugin commands the default set would have added
    for command in crate::wire_contract::registered_commands() {
        assert!(
            authority.resolve_access(&command, "main", "main", &local).is_none(),
            "{command} must not be named by the capability: it is reachable because it is not access-checked locally"
        );
        assert!(
            authority
                .resolve_access(&command, "main", "main", &remote)
                .is_none(),
            "{command} must resolve to nothing for a remote origin"
        );
    } // End of the loop over the twenty application commands
} // End of function the_capability_grants_exactly_the_two_event_permissions()

/// A local `main` webview registers the wake listener through the event plugin.
///
/// The registration the shipped window makes, over the real dispatcher and the
/// shipped capability file: `listen` invokes `plugin:event|listen` with exactly
/// [`listen_arguments`], and the answer it awaits is the listener's identifier —
/// a JSON number, which is what its unlisten function later sends back. A
/// refusal would come back as a string containing [`NOT_ALLOWED`] and a missing
/// plugin as [`unregistered`]'s phrase; a number can only have come from the
/// plugin's own body. Two registrations are made and answer different
/// identifiers, so the plugin is numbering listeners rather than answering a
/// constant.
///
/// **What this cannot see is the listener itself.** The plugin records it in a
/// table `tauri` keeps crate-private and evaluates a script on the webview that
/// the mock runtime discards, so what is measured is the grant and the crossing,
/// not that a wake would reach a page. That is a window reading's, and 2d-5-7b's.
#[test]
fn a_local_webview_registers_the_wake_listener_through_the_event_plugin() {
    let app = mock_app();
    let webview = main_window(&app);

    let first = invoke(&webview, EVENT_LISTEN, listen_arguments(1))
        .expect("the local main webview may register a listener");
    assert!(
        first.is_u64(),
        "the plugin answers the listener's identifier, never a message: {first}"
    );
    let second = invoke(&webview, EVENT_LISTEN, listen_arguments(2))
        .expect("a second registration is a second listener");
    assert!(second.is_u64(), "{second}");
    assert_ne!(
        first, second,
        "two listeners have two identifiers, so the answer is a real one"
    );
} // End of function a_local_webview_registers_the_wake_listener_through_the_event_plugin()

/// The listener `plugin:event|listen` answered is removable through
/// `plugin:event|unlisten`.
///
/// The disposal half at the boundary: the unlisten function `listen` resolves
/// with invokes this second command with the event name and the identifier, and
/// `core:event:allow-unlisten` is what lets it through. The answer is the unit
/// value, `null`; a refusal would be a string. Granting `allow-listen` alone
/// would make this the call that fails, which is the failure mode
/// `src/lib/ipc/events.ts` describes — a listener that cannot be disposed.
///
/// **What this cannot establish is that the removal happened.** The plugin's
/// `unlisten_js` answers `Ok(())` for an identifier it never held too, and its
/// table is crate-private, so the claim here is exactly *the command is granted
/// and reaches the plugin* — which is the claim the capability entry exists to
/// make true. That a listener is gone afterwards is `tauri`'s own contract, and
/// nothing here restates it as this application's.
#[test]
fn the_registered_listener_is_removable_through_the_event_plugin() {
    let app = mock_app();
    let webview = main_window(&app);

    let answered = invoke(&webview, EVENT_LISTEN, listen_arguments(1))
        .expect("the local main webview may register a listener");
    let event_id = answered.as_u64().expect("a listener identifier");

    let removed = invoke(&webview, EVENT_UNLISTEN, unlisten_arguments(event_id))
        .expect("the local main webview may remove the listener it registered");
    assert_eq!(
        removed,
        Value::Null,
        "unlisten answers the unit value, never a message: {removed}"
    );
} // End of function the_registered_listener_is_removable_through_the_event_plugin()

/// A page that is not this application cannot reach any of the twenty
/// commands, nor either event-plugin command.
///
/// The other side of the condition the tests above depend on (`PROGRESS.md`
/// R20: pin both sides, never one inside). The capability file names no
/// application command and has no `remote` block, so the dispatcher
/// access-checks every application command from a non-local origin and finds
/// nothing that allows it — a compromised or navigated webview gets a refusal
/// rather than the user's configuration directory, and cannot rewrite the
/// application's menu either. The two permissions it does grant,
/// `core:event:allow-listen` and `core:event:allow-unlisten`, are granted in
/// the local execution context only, so `plugin:event|listen` and
/// `plugin:event|unlisten` are refused from the same origin — a remote page
/// cannot subscribe to this application's wake either. The refusal is a
/// **string**, not one of our codes, which is exactly why `classifyFailure` in
/// `src/lib/ipc/errors.ts` has an `unexpected` arm instead of assuming every
/// rejection is ours.
///
/// **All twenty are attempted, and the count is asserted against the registered
/// set.** The review of Phase 1c-2b-2a found this test claiming seven while
/// invoking three, which is a real security claim carried by a body that could
/// not falsify it: remote access accidentally permitted for `get_document`
/// would have left it green. The attempt table is now compared with the names
/// parsed out of `generate_handler!` by [`crate::rust_source`], so a command
/// added to the application and forgotten here fails this test rather than
/// silently leaving the sweep. **The two plugin commands are a second table**,
/// kept apart so that the application count stays twenty: they are not in
/// `generate_handler!`, this test asserts they are not, and folding them into
/// the first table would make the count claim about two different things.
#[test]
fn a_remote_origin_is_refused() {
    let dir = synthetic_tree();
    let app = mock_app();
    let webview = main_window(&app);
    // The arguments are deliberately well formed. A malformed one would be
    // refused by the command macro, and a macro refusal would look like a
    // successful denial while proving nothing about access control.
    let identity = json!({
        "document": 0,
        "revision": "0".repeat(64),
        "node": 0,
    });
    let attempts: Vec<(&str, Value)> = vec![
        (
            "open_workspace",
            json!({ "root": dir.path().to_string_lossy() }),
        ),
        ("list_documents", json!({})),
        ("get_document", json!({ "id": 0 })),
        ("get_match", json!({ "id": identity })),
        // The command that hands out a file's contents, and so the one whose
        // refusal matters most: a navigated webview must not be able to read the
        // user's configuration back out of the application.
        ("document_text", json!({ "id": 0 })),
        ("reload_document", json!({ "id": 0 })),
        // The one command that can write a user's file, and so the one whose
        // refusal matters most after `document_text`'s: a navigated webview must
        // not be able to rearrange the user's snippets.
        (
            "move_match",
            json!({
                "id": identity,
                "after": Value::Null,
                "baseRevision": "0".repeat(64),
                "acknowledgement": { "accepted": [] },
            }),
        ),
        // The second command that can write a user's file, and the one that can
        // rewrite the *contents* of a snippet rather than only its position.
        (
            "save_match",
            json!({
                "id": identity,
                "draft": {},
                "baseRevision": "0".repeat(64),
                "acknowledgement": { "accepted": [] },
            }),
        ),
        // The third command that can write a user's file, and the first that can
        // add something to it that was never there: a navigated webview must not
        // be able to write a snippet into the user's configuration.
        (
            "create_match",
            json!({
                "document": 0,
                "newMatch": { "trigger": ":remote", "replace": "remote" },
                "position": { "End": {} },
                "baseRevision": "0".repeat(64),
                "acknowledgement": { "accepted": [] },
            }),
        ),
        // The fourth, and the only one that can take something away.
        (
            "delete_match",
            json!({
                "id": identity,
                "baseRevision": "0".repeat(64),
                "acknowledgement": { "accepted": [] },
            }),
        ),
        // The fifth, and by far the most destructive: it replaces a file's whole
        // text with whatever it is handed. A navigated webview must not be able
        // to overwrite the user's configuration with its own bytes.
        (
            "save_raw_document",
            json!({
                "document": 0,
                "baseRevision": "0".repeat(64),
                "text": "matches: []\n",
                "acknowledgement": { "accepted": [] },
            }),
        ),
        // The sixth that can write, and the one whose whole ordinary path runs
        // through the acknowledgement round trip: a navigated webview must not
        // be able to grow the user's configuration by copying its snippets.
        (
            "duplicate_match",
            json!({
                "id": identity,
                "baseRevision": "0".repeat(64),
                "acknowledgement": { "accepted": [] },
            }),
        ),
        // The three read-only backup commands. They write nothing, and they are
        // here for `document_text`'s reason rather than for a writer's: a
        // navigated webview must not be able to read the user's configuration
        // back out of the application, and a backup entry is a copy of exactly
        // that.
        ("list_backup_batches", json!({})),
        (
            "list_backup_entries",
            json!({ "batch": { "name": "2026-01-02T030405Z-0" } }),
        ),
        (
            "read_backup_text",
            json!({
                "entry": {
                    "batch": { "name": "2026-01-02T030405Z-0" },
                    "relative_path": "match/base.yml",
                },
                "document": 0,
            }),
        ),
        // The sixteenth workspace command. It writes nothing, and it is here
        // for `document_text`'s reason: a drained batch carries whole files'
        // text, so a navigated webview must not be able to read the user's
        // configuration back out of the application through it either.
        ("drain_external_changes", json!({ "afterSequence": 0 })),
        // Phase 3-7's pair. The reader hands out a snippet's own text, so a
        // navigated webview must not reach it for `document_text`'s reason; the
        // writer replaces that text, so it must not reach it for every writer's.
        ("match_item_text", json!({ "id": identity })),
        (
            "save_match_item_text",
            json!({
                "id": identity,
                "baseRevision": "0".repeat(64),
                "text": "  - trigger: ':remote'\n",
                "acknowledgement": { "accepted": [] },
            }),
        ),
        // Phase 3-10's writer. It writes several files, so a navigated webview
        // must not reach it for every writer's reason.
        (
            "apply_bulk_options",
            json!({
                "request": {
                    "changes": [{ "option": "word", "value": { "Set": "true" } }],
                    "files": [{
                        "document": 0,
                        "base_revision": "0".repeat(64),
                        "matches": [identity],
                        "consent": null,
                    }],
                    "excluded": [],
                },
            }),
        ),
        ("set_menu_labels", json!({ "labels": every_label() })),
    ];

    // Non-vacuity, and the check the old three-entry table would have failed:
    // the attempts are exactly the registered commands, in both directions.
    let attempted: std::collections::BTreeSet<String> = attempts
        .iter()
        .map(|(command, _)| (*command).to_owned())
        .collect();
    assert_eq!(
        attempted,
        crate::wire_contract::registered_commands(),
        "every registered command must be attempted from the remote origin"
    );
    assert_eq!(attempted.len(), 20, "the surface is twenty commands");

    for (command, args) in attempts {
        let error = invoke_from(&webview, REMOTE_ORIGIN, command, args)
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

    // The event plugin's two commands, from the same origin. Both are granted to
    // the local context only, and neither is an application command — asserted,
    // because a plugin command that found its way into `generate_handler!` would
    // be counted above as a twentieth.
    let plugin_attempts: [(&str, Value); 2] = [
        (EVENT_LISTEN, listen_arguments(1)),
        (EVENT_UNLISTEN, unlisten_arguments(1)),
    ];
    for (command, args) in plugin_attempts {
        assert!(
            !crate::wire_contract::registered_commands().contains(command),
            "{command} is a plugin command and must not be in generate_handler!"
        );
        let error = invoke_from(&webview, REMOTE_ORIGIN, command, args)
            .expect_err("a remote origin must not reach an event-plugin command");
        assert!(
            error.is_string(),
            "{command} must reject with the dispatcher's message, not with a code: {error}"
        );
        assert!(
            error.as_str().unwrap_or_default().contains(NOT_ALLOWED),
            "the refusal must say so: {error}"
        );
    } // End of the loop over the plugin commands a remote page must not reach
} // End of function a_remote_origin_is_refused()

/// `drain_external_changes` is registered, reachable with a capability set that
/// names no application command, and its one argument survives the crossing.
///
/// The three things only the dispatcher decides, asked of the sixteenth
/// workspace command: it is in `generate_handler!` (a missing name would come
/// back as `Command … not found`), the capability set does not block it (a
/// denial would come back as a **string** rather than as an object), and
/// `after_sequence` arrives as `afterSequence` and deserializes into a `u64`.
///
/// It also pins the two facts the wire type carries when there is nothing to
/// reconcile: the batch names the workspace epoch it belongs to, and an empty
/// batch answers the watermark it was asked with rather than zero — which is
/// what lets a caller showing that epoch store `newest_sequence`
/// unconditionally. **Both drains here are the same epoch's**, which is the
/// scope that claim carries
/// ([`espansoconfig_core::watch::retained_state`], clause 6, and
/// [`crate::reconciliation::ReconciliationBatch::newest_sequence`]) — so what
/// this test covers is the claim inside its scope and never across a
/// replacement.
///
/// **What it does not show is an external change.** Nothing here writes to the
/// tree behind the application's back, and a real filesystem observation is
/// `crate::watch_check`'s subject; what this measures is the crossing.
#[test]
fn drain_external_changes_is_reachable_and_its_watermark_deserializes() {
    let dir = synthetic_tree();
    let app = mock_app();
    let webview = main_window(&app);

    let refusal = invoke(
        &webview,
        "drain_external_changes",
        json!({ "afterSequence": 0 }),
    )
    .expect_err("no workspace is open yet, so this must fail");
    assert_eq!(
        refusal.get("code").and_then(Value::as_str),
        Some("noWorkspaceOpen"),
        "the dispatcher rejected before reaching the command: {refusal}"
    );

    invoke(
        &webview,
        "open_workspace",
        json!({ "root": dir.path().to_string_lossy() }),
    )
    .expect("the synthetic tree opens");

    let batch = invoke(
        &webview,
        "drain_external_changes",
        json!({ "afterSequence": 0 }),
    )
    .expect("an open workspace answers a batch");
    assert_eq!(batch["epoch"], 1, "the first open is epoch one: {batch}");
    assert_eq!(batch["observations"].as_array().map(Vec::len), Some(0));
    assert_eq!(batch["newest_sequence"], 0);
    assert_eq!(batch["discarded"], 0);

    // The watermark really crosses: an empty batch answers the value it was
    // asked with, so a non-zero one comes back unchanged rather than as zero.
    let later = invoke(
        &webview,
        "drain_external_changes",
        json!({ "afterSequence": 12 }),
    )
    .expect("a watermark above everything pending is legal");
    assert_eq!(
        later["newest_sequence"], 12,
        "an empty batch never moves a caller's watermark backwards within one epoch: {later}"
    );
} // End of function drain_external_changes_is_reachable_and_its_watermark_deserializes()

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
    assert!(
        matches!(failed, Err(crate::error::CommandError::MenuBuildFailed)),
        "work that answered Err must not be reported as a menu that was installed: {failed:?}"
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
