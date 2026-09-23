/**
 * The reviewed bilingual fixtures of Phase 2d-6-11b — the 2d-6 record's §3
 * entries 35 and 40.
 *
 * Every safety-critical sentence under entry 40's seven semantic bounds, and every
 * sentence Phase 2d-6-11a's bilingual mounted cases compare against
 * `translate(lang, …)` (`2d-6-11a-notes.md` §5 item 2), is pinned here as a
 * **literal** English and Spanish expectation, rendered through the typed
 * accessor a renderer uses — a `describe*` accessor in `codes.ts`, or `translate`
 * over a key function with a `never` terminus — and never through a key built by
 * hand. Where a component itself names a literal key (`t('browser.recovery…')`),
 * the fixture names the same literal key, which `TranslationKey` checks at compile
 * time.
 *
 * ## What these fixtures are, and what they are not (R35)
 *
 * The wording was read against the English and against its bound in
 * `2d-6-11b-notes.md` §2, a prose review by the implementing agent and not a native
 * speaker's. **A literal fixture protects approved wording and nothing else**: it
 * fails when a sentence drifts from what was reviewed, and it cannot fail when the
 * reviewed sentence is wrong, ungrammatical or — for the Spanish — not Spanish.
 * It does not prove translation quality, meaning, or that anything draws the
 * sentence. A correction is a deliberate edit to the dictionary and to this file
 * together.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers in this file do.
 */

import { describe, expect, it } from 'vitest';
import { conflictOriginMessageKey } from '../browser/conflictSource';
import {
  externalEvidenceRefusalKey,
  reapplyOutcomeKey,
  SUPERSEDED_EVIDENCE_KEY
} from '../browser/reapply';
import {
  describeConflictMessage,
  describeExternalConflictNotice,
  describeReconciliationControl,
  describeReconciliationFileState,
  describeReconciliationRefusal,
  describeReconciliationWorkspaceState,
  describeUnreadableReason
} from './codes';
import { translate } from './dictionaries';
import { LOCALES, type Locale } from './locale';

/**
 * The seven semantic bounds of entry 40, one name each:
 * - `stale` — needs reconciliation, and says nothing about what changed or who;
 * - `notWatched` — no coverage;
 * - `registrationFailed` — subscribing failed, not that native observation stopped;
 * - `removed` — no longer present in the observed workspace, never "deleted";
 * - `uncertainty` — an unknown outcome, never a failure or a success;
 * - `originAndReapply` — no write in response to this observation or action;
 * - `supersession` — accepted evidence changed, never that the disk is newer.
 */
type Bound =
  | 'stale'
  | 'notWatched'
  | 'registrationFailed'
  | 'removed'
  | 'uncertainty'
  | 'originAndReapply'
  | 'supersession';

/** Every bound, in entry 40's order. */
const BOUNDS: readonly Bound[] = [
  'stale',
  'notWatched',
  'registrationFailed',
  'removed',
  'uncertainty',
  'originAndReapply',
  'supersession'
];

/** One reviewed sentence: how a renderer reaches it, and its two literals. */
interface Fixture {
  /** What the sentence is, for the failure message. */
  readonly label: string;
  /** The sentence as the typed accessor renders it in one locale. */
  readonly render: (locale: Locale) => string;
  /** The reviewed English. */
  readonly en: string;
  /** The reviewed Spanish. */
  readonly es: string;
}

/** A reviewed sentence that carries one of entry 40's bounds. */
interface BoundFixture extends Fixture {
  /** The bound it carries. */
  readonly bound: Bound;
}

/** The observed revision operand; a digest nobody compares, so any 64 hex digits. */
const REVISION = 'c'.repeat(64);

const BOUND_FIXTURES: readonly BoundFixture[] = [
  {
    bound: 'stale',
    label: 'the header sentence of a stale file',
    render: (locale) => describeReconciliationFileState(locale, { kind: 'stale' }, 'header'),
    en: 'What this window shows of this file has not been reconciled with the file on disk.',
    es: 'Lo que esta ventana muestra de este archivo no se ha conciliado con el archivo del disco.'
  },
  {
    bound: 'stale',
    label: 'the sidebar mark of a stale file',
    render: (locale) => describeReconciliationFileState(locale, { kind: 'stale' }, 'sidebarRow'),
    en: 'Not reconciled',
    es: 'Sin conciliar'
  },
  {
    bound: 'stale',
    label: 'the reread control',
    render: (locale) => describeReconciliationControl(locale, 'staleFileReread'),
    en: 'Read this file again',
    es: 'Volver a leer este archivo'
  },
  {
    bound: 'notWatched',
    label: 'the not-watched banner',
    render: (locale) => describeReconciliationWorkspaceState(locale, { kind: 'notWatched' }),
    en: 'Automatic watching is unavailable for this workspace. Changes made to its files outside this app are not detected here.',
    es: 'La vigilancia automática no está disponible para este espacio de trabajo. Los cambios que se hagan en sus archivos fuera de esta aplicación no se detectan aquí.'
  },
  {
    bound: 'registrationFailed',
    label: 'the refused-subscription banner',
    render: (locale) => describeReconciliationWorkspaceState(locale, { kind: 'registrationFailed', reason: 'rejected' }),
    en: 'This window could not subscribe to change notifications, so it is not told when a file changes on disk.',
    es: 'Esta ventana no pudo suscribirse a los avisos de cambios, así que no se le avisa cuando un archivo cambia en el disco.'
  },
  {
    bound: 'registrationFailed',
    label: 'the no-transport banner',
    render: (locale) => describeReconciliationWorkspaceState(locale, { kind: 'registrationFailed', reason: 'noTransport' }),
    en: 'This window was started without a source of change notifications, so it is not told when a file changes on disk.',
    es: 'Esta ventana se inició sin ninguna fuente de avisos de cambios, así que no se le avisa cuando un archivo cambia en el disco.'
  },
  {
    bound: 'removed',
    label: 'the header sentence of a removed file',
    render: (locale) => describeReconciliationFileState(locale, { kind: 'removed' }, 'header'),
    en: 'This file is no longer present in the observed workspace.',
    es: 'Este archivo ya no está presente en el espacio de trabajo observado.'
  },
  {
    bound: 'removed',
    label: 'the path-drift banner of a removed path',
    render: (locale) => describeReconciliationWorkspaceState(locale, { kind: 'pathDrift', relativePath: 'match/c.yml', detail: { kind: 'removed' } }),
    en: 'A file this window has no entry for is no longer present in the observed workspace: match/c.yml',
    es: 'Un archivo del que esta ventana no tiene ninguna entrada ya no está presente en el espacio de trabajo observado: match/c.yml'
  },
  {
    bound: 'uncertainty',
    label: 'the surface’s unknown-outcome sentence',
    render: (locale) => describeReconciliationFileState(locale, { kind: 'writeOutcomeUnknown' }, 'surface'),
    en: 'The earlier write’s outcome is unknown. Reviewing this disk snapshot cannot establish whether that write completed.',
    es: 'Se desconoce el resultado de la escritura anterior. Revisar esta instantánea del disco no permite establecer si esa escritura llegó a completarse.'
  },
  {
    bound: 'uncertainty',
    label: 'the route’s unknown-outcome sentence',
    render: (locale) => describeReconciliationFileState(locale, { kind: 'writeOutcomeUnknown' }, 'workspaceRoute'),
    en: 'The outcome of an earlier write to this file is unknown, and the panel it was made from has closed. While this stands, a change observed on disk is not loaded into this window on its own.',
    es: 'Se desconoce el resultado de una escritura anterior en este archivo, y el panel desde el que se hizo se ha cerrado. Mientras siga así, un cambio observado en el disco no se carga en esta ventana por su cuenta.'
  },
  {
    bound: 'uncertainty',
    label: 'the unknown-outcome notice on a panel',
    render: (locale) => describeExternalConflictNotice(locale, { kind: 'writeOutcomeUnknown' }),
    en: 'The earlier write’s outcome is unknown. Reviewing this disk snapshot cannot establish whether that write completed.',
    es: 'Se desconoce el resultado de la escritura anterior. Revisar esta instantánea del disco no permite establecer si esa escritura llegó a completarse.'
  },
  {
    bound: 'uncertainty',
    label: 'the unresolved-uncertainty refusal',
    render: (locale) => describeReconciliationRefusal(locale, 'uncertaintyUnresolved'),
    en: 'The outcome of an earlier write to this file is unknown and has not been acknowledged.',
    es: 'Se desconoce el resultado de una escritura anterior en este archivo y no se ha reconocido.'
  },
  {
    bound: 'uncertainty',
    label: 'the moved-hold refusal',
    render: (locale) => describeReconciliationRefusal(locale, 'holdMoved'),
    en: 'The unknown-outcome state this snapshot was shown for has ended, or a later one has replaced it.',
    es: 'El estado de resultado desconocido para el que se mostró esta instantánea ha terminado, o lo ha sustituido otro posterior.'
  },
  {
    bound: 'uncertainty',
    label: 'the acknowledgement label',
    render: (locale) => describeReconciliationControl(locale, 'acknowledgeUncertainty'),
    en: 'I have reviewed this snapshot',
    es: 'He revisado esta instantánea'
  },
  {
    bound: 'originAndReapply',
    label: 'the watched origin line',
    render: (locale) => translate(locale, conflictOriginMessageKey({ kind: 'changedWhileOpen' })),
    en: 'What is compared here came from watching the file: it changed on disk while this was open. No save was initiated in response to this observation, so nothing was written from here in response to it, and this app cannot say what changed the file or when.',
    es: 'Lo que se compara aquí viene de la vigilancia del archivo: cambió en el disco mientras esto estaba abierto. No se ha iniciado ningún guardado como respuesta a esta observación, así que desde aquí no se ha escrito nada como respuesta a ella, y esta aplicación no puede decir qué cambió el archivo ni cuándo.'
  },
  {
    bound: 'originAndReapply',
    label: 'the refused-save origin line',
    render: (locale) => translate(locale, conflictOriginMessageKey({ kind: 'refusedSave' })),
    en: 'What is compared here came from a save this app attempted: the file had already changed since its text was loaded here, so the write was refused under the file\'s own lock.',
    es: 'Lo que se compara aquí viene de un guardado que intentó esta aplicación: el archivo ya había cambiado desde que su texto se cargó aquí, así que la escritura se rechazó bajo el bloqueo del propio archivo.'
  },
  {
    bound: 'originAndReapply',
    label: 'the external conflict’s first line',
    render: (locale) => describeConflictMessage(locale, { kind: 'fileChangedWhileOpen' }),
    en: 'This file changed on disk while this panel was open. No save was initiated in response to this observation, and this app cannot say what changed the file or when.',
    es: 'Este archivo ha cambiado en el disco mientras este panel estaba abierto. No se ha iniciado ningún guardado como respuesta a esta observación, y esta aplicación no puede decir qué cambió el archivo ni cuándo.'
  },
  {
    bound: 'originAndReapply',
    label: 'the reapply outcome reapplied',
    render: (locale) => translate(locale, reapplyOutcomeKey('reapplied')),
    en: 'This window now shows the version on disk, with what you kept set up over it. This reapply attempt wrote nothing: send it when you are ready, and that save can still be refused or conflict.',
    es: 'Esta ventana muestra ahora la versión en disco, con lo que conservaste preparado sobre ella. Este intento de reaplicar no ha escrito nada: envíalo cuando quieras, y ese guardado todavía puede rechazarse o entrar en conflicto.'
  },
  {
    bound: 'originAndReapply',
    label: 'the reapply outcome alreadySatisfied',
    render: (locale) => translate(locale, reapplyOutcomeKey('alreadySatisfied')),
    en: 'This window now shows the version on disk, and that version already holds what you asked for, so there is nothing left to send. This reapply attempt wrote nothing.',
    es: 'Esta ventana muestra ahora la versión en disco, y esa versión ya contiene lo que pediste, así que no queda nada por enviar. Este intento de reaplicar no ha escrito nada.'
  },
  {
    bound: 'originAndReapply',
    label: 'the reapply outcome manualResolution',
    render: (locale) => translate(locale, reapplyOutcomeKey('manualResolution')),
    en: 'espansoConfig applied nothing. This reapply attempt wrote nothing, this window was not moved, and what you kept is still here exactly as it was. The reason follows.',
    es: 'espansoConfig no ha aplicado nada. Este intento de reaplicar no ha escrito nada, esta ventana no se ha movido y lo que conservaste sigue aquí exactamente igual. El motivo es el siguiente.'
  },
  {
    bound: 'originAndReapply',
    label: 'the reapply outcome adoptionRefused',
    render: (locale) => translate(locale, reapplyOutcomeKey('adoptionRefused')),
    en: 'This window would not move to the version on disk, so nothing was rebuilt and this reapply attempt wrote nothing. What you kept is still here. You can carry on here, or stop and open the file again to start from what it holds now.',
    es: 'Esta ventana no ha pasado a la versión en disco, así que no se ha reconstruido nada y este intento de reaplicar no ha escrito nada. Lo que conservaste sigue aquí. Puedes seguir aquí, o cerrar esto y abrir el archivo de nuevo para partir de lo que contiene ahora.'
  },
  {
    bound: 'originAndReapply',
    label: 'the reapply outcome unavailable',
    render: (locale) => translate(locale, reapplyOutcomeKey('unavailable')),
    en: 'This panel cannot keep what you have here against the version on disk. This reapply attempt wrote nothing and discarded nothing.',
    es: 'Este panel no puede conservar lo que tienes aquí frente a la versión en disco. Este intento de reaplicar no ha escrito nada ni ha descartado nada.'
  },
  {
    bound: 'originAndReapply',
    label: 'the reapply outcome notAttempted',
    render: (locale) => translate(locale, reapplyOutcomeKey('notAttempted')),
    en: 'There was no conflict to work from, so this window was not asked to do anything, and this reapply attempt wrote nothing.',
    es: 'No había ningún conflicto del que partir, así que no se ha pedido nada a esta ventana, y este intento de reaplicar no ha escrito nada.'
  },
  {
    bound: 'originAndReapply',
    label: 'the external-evidence refusal noCorrespondence',
    render: (locale) => translate(locale, externalEvidenceRefusalKey('noCorrespondence')),
    en: 'The reading that told espansoConfig this file had changed carried no correspondence for it, so there is nothing here to match what you kept against. This reapply attempt wrote nothing.',
    es: 'La lectura que avisó a espansoConfig de que este archivo había cambiado no traía ninguna correspondencia, así que aquí no hay nada con lo que comparar lo que has conservado. Este intento de reaplicar no ha escrito nada.'
  },
  {
    bound: 'originAndReapply',
    label: 'the external-evidence refusal baseRevisionMoved',
    render: (locale) => translate(locale, externalEvidenceRefusalKey('baseRevisionMoved')),
    en: 'The correspondence that reading carried was worked out from a different version of this file than the one you started from, so it says nothing about what you kept. This reapply attempt wrote nothing.',
    es: 'La correspondencia que traía esa lectura se calculó a partir de una versión de este archivo distinta de aquella desde la que empezaste, así que no dice nada sobre lo que has conservado. Este intento de reaplicar no ha escrito nada.'
  },
  {
    bound: 'originAndReapply',
    label: 'the external-evidence refusal diskRevisionMoved',
    render: (locale) => translate(locale, externalEvidenceRefusalKey('diskRevisionMoved')),
    en: 'The correspondence that reading carried was worked out against a different version on disk than the one shown here, so it is evidence about a state you were not shown. This reapply attempt wrote nothing.',
    es: 'La correspondencia que traía esa lectura se calculó frente a una versión en disco distinta de la que se muestra aquí, así que es evidencia sobre un estado que no se te ha mostrado. Este intento de reaplicar no ha escrito nada.'
  },
  {
    bound: 'originAndReapply',
    label: 'the external-evidence refusal noRowForBase',
    render: (locale) => translate(locale, externalEvidenceRefusalKey('noRowForBase')),
    en: 'The correspondence that reading carried has no row for the snippet espansoConfig needed to find again, so there is nothing here to match what you kept against. This reapply attempt wrote nothing.',
    es: 'La correspondencia que traía esa lectura no tiene ninguna fila para el fragmento que espansoConfig necesitaba volver a encontrar, así que aquí no hay nada con lo que comparar lo que has conservado. Este intento de reaplicar no ha escrito nada.'
  },
  {
    bound: 'originAndReapply',
    label: 'the external-evidence refusal severalRowsForBase',
    render: (locale) => translate(locale, externalEvidenceRefusalKey('severalRowsForBase')),
    en: 'The correspondence that reading carried names the snippet espansoConfig needed to find again in more than one row, which a correspondence never should, so none of those rows can be trusted. This reapply attempt wrote nothing.',
    es: 'La correspondencia que traía esa lectura nombra en más de una fila el fragmento que espansoConfig necesitaba volver a encontrar, cosa que una correspondencia nunca debería hacer, así que no se puede confiar en ninguna de esas filas. Este intento de reaplicar no ha escrito nada.'
  },
  {
    bound: 'supersession',
    label: 'the reapply supersession sentence',
    render: (locale) => translate(locale, SUPERSEDED_EVIDENCE_KEY),
    en: 'The evidence this panel was comparing against has been superseded by another accepted reading of this file, so there is nothing here to match what you kept against. This reapply attempt wrote nothing.',
    es: 'La evidencia con la que este panel comparaba ha quedado sustituida por otra lectura aceptada de este archivo, así que aquí no hay nada con lo que comparar lo que has conservado. Este intento de reaplicar no ha escrito nada.'
  },
  {
    bound: 'supersession',
    label: 'the superseded acknowledgement refusal',
    render: (locale) => describeReconciliationRefusal(locale, 'superseded'),
    en: 'This panel’s evidence has been superseded by another accepted reading.',
    es: 'La evidencia de este panel ha quedado sustituida por otra lectura aceptada.'
  }
];

const TRANSLATE_CASE_FIXTURES: readonly Fixture[] = [
  {
    label: 'the lost-history banner',
    render: (locale) => describeReconciliationWorkspaceState(locale, { kind: 'lostHistory' }),
    en: 'Some observed changes to this workspace were lost, so incremental reconciliation is suspended. Nothing more is reconciled until the workspace is reloaded, and reloading needs every editing panel closed first.',
    es: 'Se han perdido algunos cambios observados de este espacio de trabajo, así que la conciliación incremental está suspendida. No se concilia nada más hasta que se recargue el espacio de trabajo, y para recargarlo hay que cerrar antes todos los paneles de edición.'
  },
  {
    label: 'the lost-history recovery control',
    render: (locale) => describeReconciliationControl(locale, 'lostHistoryRecovery'),
    en: 'Reload the workspace',
    es: 'Recargar el espacio de trabajo'
  },
  {
    label: 'the retry control',
    render: (locale) => describeReconciliationControl(locale, 'retryRetainedObservation'),
    en: 'Check the observed change now',
    es: 'Comprobar ahora el cambio observado'
  },
  {
    label: 'the retained-observation sentence',
    render: (locale) => describeExternalConflictNotice(locale, { kind: 'observationRetained' }),
    en: 'An observed change is waiting to be checked against this window’s state.',
    es: 'Un cambio observado está a la espera de comprobarse frente al estado de esta ventana.'
  },
  {
    label: 'the header sentence of an unreadable file',
    render: (locale) => describeReconciliationFileState(locale, { kind: 'unavailable', reason: { PermissionDenied: {} } }, 'header'),
    en: 'This file could not be read when it was last observed. What is shown is the last version this window read.',
    es: 'Este archivo no se pudo leer la última vez que se observó. Lo que se muestra es la última versión que leyó esta ventana.'
  },
  {
    label: 'the sidebar mark of an unreadable file',
    render: (locale) => describeReconciliationFileState(locale, { kind: 'unavailable', reason: { PermissionDenied: {} } }, 'sidebarRow'),
    en: 'Unreadable when observed',
    es: 'Ilegible al observarse'
  },
  {
    label: 'the permission-denied reason drawn beside it',
    render: (locale) => describeUnreadableReason(locale, { PermissionDenied: {} }),
    en: 'Your system refused espansoConfig permission to read this file.',
    es: 'Tu sistema le denegó a espansoConfig el permiso para leer este archivo.'
  },
  {
    label: 'the observed revision',
    render: (locale) => translate(locale, 'browser.externalConflict.revisionObserved', { revision: REVISION }),
    en: 'The version read from disk when this change was observed is cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.',
    es: 'La versión leída del disco cuando se observó este cambio es cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.'
  },
  {
    label: 'the affected file',
    render: (locale) => translate(locale, 'browser.externalConflict.affectedFile', { path: 'match/c.yml' }),
    en: 'The file this change is about: match/c.yml',
    es: 'El archivo al que se refiere este cambio: match/c.yml'
  },
  {
    label: 'the destination-less form’s line',
    render: (locale) => translate(locale, 'browser.externalConflict.destinationRequired'),
    en: 'This form does not name a file yet, so the only way forward from this change is choosing the file it goes in. Nothing has been chosen for you, and neither loading the version on disk nor keeping your draft is offered until a file is chosen.',
    es: 'Este formulario todavía no indica ningún archivo, así que la única forma de seguir desde este cambio es elegir el archivo en el que va. No se ha elegido ninguno por ti, y ni cargar la versión del disco ni conservar tu borrador se ofrecen hasta que se elija un archivo.'
  },
  {
    label: 'the recovery form’s reload consequence',
    render: (locale) => translate(locale, 'browser.recovery.reloadEndsRecovery'),
    en: 'A file on disk holds no half-written snippet, so there is nothing there this panel could be filled from. This panel closes, the file is not written, and what you typed here cannot be brought back afterwards.',
    es: 'Un archivo en disco no contiene ningún fragmento a medio escribir, así que ahí no hay nada con lo que rellenar este panel. Este panel se cierra, el archivo no se escribe y lo que escribiste aquí no se podrá recuperar después.'
  },
  {
    label: 'the editor’s reload consequence',
    render: (locale) => translate(locale, 'browser.matchEditor.reloadIdentifiesNoSnippet'),
    en: 'This app will not guess which snippet in the version on disk corresponds to the one you are editing. Open the snippet again from the list afterwards.',
    es: 'Esta aplicación no va a adivinar qué fragmento de la versión del disco se corresponde con el que estás editando. Vuelve a abrir el fragmento desde la lista después.'
  },
  {
    label: 'the creator’s reload consequence',
    render: (locale) => translate(locale, 'browser.matchCreation.reloadSeedsNoForm'),
    en: 'A file on disk holds no half-written snippet, so there is nothing there this form could be filled from. A form opened afterwards starts empty.',
    es: 'Un archivo en disco no contiene ningún fragmento a medio escribir, así que ahí no hay nada con lo que rellenar este formulario. Un formulario que se abra después empieza vacío.'
  },
  {
    label: 'the draft-copied line',
    render: (locale) => translate(locale, 'browser.saveOutcome.draftCopied'),
    en: 'A labelled copy of what you wrote was put on the clipboard.',
    es: 'Se ha puesto en el portapapeles una copia con etiquetas de lo que escribiste.'
  },
  {
    label: 'the draft-copy-failed line',
    render: (locale) => translate(locale, 'browser.saveOutcome.draftCopyFailed'),
    en: 'What you wrote could not be put on the clipboard. It is still shown above, but any character no font can draw is written there by name instead of as itself, so selecting it by hand does not always give back exactly what you wrote. Loading the version on disk discards it either way.',
    es: 'No se ha podido poner en el portapapeles lo que escribiste. Se sigue mostrando arriba, pero los caracteres que ninguna tipografía puede dibujar se escriben ahí por su nombre y no como tales, así que seleccionarlo a mano no siempre devuelve exactamente lo que escribiste. Cargar la versión del disco lo descarta de todas formas.'
  }
];


/**
 * The literal a fixture pins in one locale.
 *
 * @param fixture - The fixture.
 * @param locale - The locale.
 * @returns The reviewed sentence in that locale.
 */
function expected(fixture: Fixture, locale: Locale): string {
  return locale === 'en' ? fixture.en : fixture.es;
} // End of function expected()

describe('the reviewed bilingual fixtures of entry 40', () => {
  it.each(LOCALES)('render every bound sentence as its reviewed literal in %s', (locale) => {
    for (const fixture of BOUND_FIXTURES) {
      expect(fixture.render(locale), `${locale}: ${fixture.bound}: ${fixture.label}`).toBe(
        expected(fixture, locale)
      );
    } // End of the loop over every bound fixture
  }); // End of the "every bound sentence" case

  it('pin at least one sentence under each of the seven bounds', () => {
    for (const bound of BOUNDS) {
      expect(
        BOUND_FIXTURES.some((fixture) => fixture.bound === bound),
        bound
      ).toBe(true);
    } // End of the loop over the seven bounds
  }); // End of the "each bound" case

  it('pin two distinct literals per sentence, neither of them empty', () => {
    // A Spanish literal equal to the English one would mean the dictionary fell
    // back or was never translated; the check is on the fixture, so a fixture
    // copied from the wrong column fails here before it pins anything.
    for (const fixture of [...BOUND_FIXTURES, ...TRANSLATE_CASE_FIXTURES]) {
      expect(fixture.en.trim(), fixture.label).not.toBe('');
      expect(fixture.es.trim(), fixture.label).not.toBe('');
      expect(fixture.es, fixture.label).not.toBe(fixture.en);
    } // End of the loop over every fixture
  }); // End of the "two distinct literals" case

  it('keep the removed sentences free of a deletion and the supersession sentences free of a newer disk', () => {
    // The two bounds whose forbidden word is short enough to scan for; the others
    // are carried by the literals above.
    for (const fixture of BOUND_FIXTURES) {
      if (fixture.bound === 'removed') {
        expect(fixture.en.toLowerCase(), fixture.label).not.toMatch(/\bdeleted\b/);
        expect(fixture.es.toLowerCase(), fixture.label).not.toMatch(/\bborrad|\beliminad/);
      }
      if (fixture.bound === 'supersession') {
        expect(fixture.en.toLowerCase(), fixture.label).not.toMatch(/\bnewer\b/);
        expect(fixture.es.toLowerCase(), fixture.label).not.toMatch(/más reciente/);
      }
    } // End of the loop over every bound fixture
  }); // End of the "removed and supersession absences" case
}); // End of the "entry 40 fixtures" suite

describe('the reviewed literals behind 2d-6-11a’s bilingual cases', () => {
  it.each(LOCALES)('render every sentence those cases read through translate as its reviewed literal in %s', (locale) => {
    for (const fixture of TRANSLATE_CASE_FIXTURES) {
      expect(fixture.render(locale), `${locale}: ${fixture.label}`).toBe(expected(fixture, locale));
    } // End of the loop over every 11a fixture
  }); // End of the "11a sentences" case
}); // End of the "11a literals" suite

describe('the labels the prose review separated', () => {
  it('give the deleter’s and the duplicator’s close control a label of its own beside “keep what I asked for”', () => {
    // Both are drawn on one panel under a conflict with different effects — the
    // close control closes it, the choice keeps it — and until 2d-6-11b both read
    // *Dejarlo como está* in Spanish (`2d-6-7b-notes.md` §4 item 1).
    expect(translate('en', 'browser.matchDeletion.close')).toBe('Leave this alone');
    expect(translate('es', 'browser.matchDeletion.close')).toBe('Dejarlo estar');
    expect(translate('en', 'browser.matchDuplication.close')).toBe('Leave this alone');
    expect(translate('es', 'browser.matchDuplication.close')).toBe('Dejarlo estar');
    expect(translate('en', 'browser.saveOutcome.choice.keepOperation')).toBe('Leave this as it is');
    expect(translate('es', 'browser.saveOutcome.choice.keepOperation')).toBe('Dejarlo como está');
    for (const locale of LOCALES) {
      const keep = translate(locale, 'browser.saveOutcome.choice.keepOperation');
      expect(translate(locale, 'browser.matchDeletion.close'), locale).not.toBe(keep);
      expect(translate(locale, 'browser.matchDuplication.close'), locale).not.toBe(keep);
    } // End of the loop over both locales
  }); // End of the "close labels" case
}); // End of the "separated labels" suite
