require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', '..', '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'DualCam'
  s.version        = '1.0.0'
  s.summary        = 'Simultaneous front and back capture for Side Huddle reactions.'
  s.description    = 'Wraps AVCaptureMultiCamSession so a reaction can show your face and what you are watching in one frame.'
  s.author         = 'Side Huddle Sports'
  s.homepage       = 'https://www.sidehuddlesports.com'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: 'https://github.com/tbaileyxi/chatflow-ai-demo' }
  s.static_framework = true
  s.license        = { :type => 'MIT' }

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
