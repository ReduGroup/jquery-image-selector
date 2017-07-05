<?php

//
// A simple example of saving an image on the server side given the data provided by the plugin.
//

$pattern = '/^data:([^,;]+)(;base64)?,(.*)$/i';
if (preg_match($pattern, $_POST['image'], $matches) && count($matches) === 4) {
    $mime = trim($matches[1]);
    $base64Encoded = $matches[2] === ';base64';
    $imageData = $base64Encoded ? base64_decode($matches[3]) : $matches[3];

    if (!in_array($mime, ['image/png', 'image/jpeg', 'image/gif'])) {
        die('Unsupported image');
    }

    $image = imagecreatefromstring($imageData);
    if ($image !== false) {
        imagepng($image, __DIR__ . '/image.png');
        imagedestroy($image);
    }
}

