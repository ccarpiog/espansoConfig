//! The Rust to frontend event bridge (plan section 6.1).
//!
//! **Deliberately empty in Phase 1b-1.** Every event this module will carry is
//! produced by something that does not exist yet: `crate::watch` reporting a
//! file changed underneath the user (plan section 6.5), and the save
//! transaction reporting progress (plan section 6.6). Declaring event names now
//! would be inventing a protocol for a producer nobody has written.
//!
//! When it does gain contents, the same rule as `commands` applies: an event
//! payload is a code plus structured operands, never a rendered English
//! sentence. The frontend owns every word the user reads.
