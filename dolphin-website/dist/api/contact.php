<?php

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request']);
    exit;
}

$name = trim((string) ($input['name'] ?? ''));
$email = trim((string) ($input['email'] ?? ''));
$phone = trim((string) ($input['phone'] ?? ''));
$dates = trim((string) ($input['dates'] ?? ''));
$selection = trim((string) ($input['selection'] ?? 'general'));
$message = trim((string) ($input['message'] ?? ''));

if ($name === '' || $phone === '' || $dates === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['error' => 'Please complete all required fields']);
    exit;
}

if (mb_strlen($name) > 120 || mb_strlen($email) > 190 || mb_strlen($phone) > 50 || mb_strlen($dates) > 120 || mb_strlen($selection) > 50 || mb_strlen($message) > 3000) {
    http_response_code(422);
    echo json_encode(['error' => 'One or more fields are too long']);
    exit;
}

$config = require __DIR__ . '/config.php';

try {
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', $config['host'], $config['database'], $config['charset']);
    $pdo = new PDO($dsn, $config['username'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec('CREATE TABLE IF NOT EXISTS website_inquiries (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(190) NOT NULL, phone VARCHAR(50) NOT NULL, preferred_dates VARCHAR(120) NOT NULL, selection VARCHAR(50) NOT NULL, message TEXT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    $statement = $pdo->prepare('INSERT INTO website_inquiries (name, email, phone, preferred_dates, selection, message) VALUES (:name, :email, :phone, :dates, :selection, :message)');
    $statement->execute([
        ':name' => $name,
        ':email' => $email,
        ':phone' => $phone,
        ':dates' => $dates,
        ':selection' => $selection,
        ':message' => $message,
    ]);
    echo json_encode(['ok' => true]);
} catch (Throwable $exception) {
    error_log('Dolphin website contact form error: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Unable to save inquiry']);
}
