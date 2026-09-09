# Auth illustration

The auth screens (login, forgot password, OTP, reset password) show a 3D character
sitting cross-legged with a phone, on top of the indigo blob.

That image is a raster asset embedded in the Figma file. It could not be pulled via the
Figma MCP (the account only has View access). To make it appear:

1. Open the Figma file, select the illustration node on the login frame.
2. Export it as PNG (2x, transparent background).
3. Save it here as `person-3d.png`.

Until then, `AuthLayout` just renders the blob without the character (it hides the
`<img>` on load error).
