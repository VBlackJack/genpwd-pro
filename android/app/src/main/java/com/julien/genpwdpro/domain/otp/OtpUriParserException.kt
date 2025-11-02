package com.julien.genpwdpro.domain.otp

open class OtpUriParserException(message: String) : Exception(message)

class OtpUriMigrationNotSupportedException : OtpUriParserException(
    "Google Authenticator migration payloads are not supported"
)
