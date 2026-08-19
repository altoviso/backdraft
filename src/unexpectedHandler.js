let unexpectedHandler = function (e) {
    // eslint-disable-next-line no-console
    console.error(e);
};

export function getUnexpectedHandler() {
    return unexpectedHandler;
}

export function setUnexpectedHandler(h) {
    const oldHandler = unexpectedHandler;
    unexpectedHandler = h;
    return oldHandler;
}

export function handleUnexpected(e) {
    unexpectedHandler(e);
}
