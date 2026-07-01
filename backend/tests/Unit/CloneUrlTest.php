<?php

use App\Action\CloneProjectFromGit;

it('embeds the token in an https url', function () {
    expect(CloneProjectFromGit::tokenUrl('https://github.com/acme/app.git', 'abc123'))
        ->toBe('https://abc123@github.com/acme/app.git');
});

it('url-encodes the token', function () {
    expect(CloneProjectFromGit::tokenUrl('https://gitlab.com/x/y.git', 'a b/c'))
        ->toBe('https://a%20b%2Fc@gitlab.com/x/y.git');
});
