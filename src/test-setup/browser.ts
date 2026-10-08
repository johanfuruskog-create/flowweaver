/*
 * Design tokens in the browser tests.
 *
 * The library sets its tokens on its own tags, one step down from `:root`. The
 * tests often mount individual parts — a `flow-node` without its `guide-editor`
 * — and those would then lack the variables, making colour-dependent
 * measurements meaningless.
 *
 * The opt-in class on `<body>` is the same route a host takes to dress a whole
 * area. The tests therefore do what a host does, not something of their own.
 */
import "../viewer/styles/tokens.scss";

document.body.classList.add("flowweaver-scope");
